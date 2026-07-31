package org.behaviortree.core;

import java.io.IOException;
import java.io.StringReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import org.w3c.dom.Attr;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NamedNodeMap;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;

/** Parses BehaviorTree.CPP-format XML into a {@link Tree}, using node types registered on a
 * {@link BehaviorTreeFactory}. */
final class XmlTreeBuilder
{
  private static final List<String> EXPLICIT_TAGS = List.of("Action", "Condition", "Control",
                                                             "Decorator");

  private final BehaviorTreeFactory factory;
  private final AtomicInteger nextUid = new AtomicInteger(1);
  private Tree tree;

  XmlTreeBuilder(BehaviorTreeFactory factory)
  {
    this.factory = factory;
  }

  // ---------------------------------------------------------------- loading

  void registerFromText(String xmlText, Path basePath)
  {
    Document doc = parseXml(xmlText);
    Element root = doc.getDocumentElement();
    if(root == null || !root.getTagName().equals("root"))
    {
      throw new RuntimeError("XML must have a <root> element");
    }
    String mainAttr = root.getAttribute("main_tree_to_execute");
    factory.setMainTreeToExecute(mainAttr);

    for(Element child : children(root))
    {
      switch(child.getTagName())
      {
        case "include":
        {
          String path = child.getAttribute("path");
          if(basePath == null)
          {
            throw new RuntimeError("Cannot resolve <include path=\"" + path + "\"> without a "
                                   + "base directory; load this tree with "
                                   + "registerBehaviorTreeFromFile()/createTreeFromFile() "
                                   + "instead of the *Text variants");
          }
          Path resolved = basePath.resolve(path).normalize();
          String includedText;
          try
          {
            includedText = Files.readString(resolved);
          }
          catch(IOException e)
          {
            throw new RuntimeError("Cannot read included file [" + resolved + "]: "
                                   + e.getMessage());
          }
          registerFromText(includedText, resolved.getParent());
          break;
        }
        case "BehaviorTree":
        {
          String id = child.getAttribute("ID");
          if(id.isEmpty())
          {
            throw new RuntimeError("<BehaviorTree> requires an ID attribute");
          }
          factory.treeDefinitions().put(id, child);
          break;
        }
        case "TreeNodesModel":
          parseTreeNodesModel(child);
          break;
        default:
          // ignore unknown top-level elements
      }
    }
  }

  private void parseTreeNodesModel(Element modelEl)
  {
    for(Element nodeEl : children(modelEl))
    {
      if(!nodeEl.getTagName().equals("SubTree"))
      {
        continue;
      }
      String id = nodeEl.getAttribute("ID");
      if(id.isEmpty())
      {
        continue;
      }
      PortsList ports = new PortsList();
      for(Element portEl : children(nodeEl))
      {
        PortDirection direction;
        switch(portEl.getTagName())
        {
          case "input_port":
            direction = PortDirection.INPUT;
            break;
          case "output_port":
            direction = PortDirection.OUTPUT;
            break;
          case "inout_port":
            direction = PortDirection.INOUT;
            break;
          default:
            continue;
        }
        String name = portEl.getAttribute("name");
        if(name.isEmpty())
        {
          continue;
        }
        PortInfo info = new PortInfo(direction);
        if(portEl.hasAttribute("default"))
        {
          info.setDefaultValue(portEl.getAttribute("default"));
        }
        ports.put(name, info);
      }
      factory.subtreeModels().put(id, ports);
    }
  }

  private static Document parseXml(String xmlText)
  {
    try
    {
      DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
      // Harden against XXE: no DOCTYPE declarations, no external entities.
      factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
      factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
      factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
      factory.setXIncludeAware(false);
      factory.setExpandEntityReferences(false);
      factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
      factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
      DocumentBuilder builder = factory.newDocumentBuilder();
      return builder.parse(new InputSource(new StringReader(xmlText)));
    }
    catch(ParserConfigurationException | SAXException | IOException e)
    {
      throw new RuntimeError("Failed to parse behavior tree XML: " + e.getMessage());
    }
  }

  // ---------------------------------------------------------------- instantiation

  Tree instantiateTree(Blackboard rootBlackboard, String requestedMainTreeId)
  {
    String mainId = requestedMainTreeId;
    if(mainId == null || mainId.isEmpty())
    {
      mainId = factory.mainTreeToExecute();
    }
    if((mainId == null || mainId.isEmpty()) && factory.treeDefinitions().size() == 1)
    {
      mainId = factory.treeDefinitions().keySet().iterator().next();
    }
    if(mainId == null || mainId.isEmpty())
    {
      throw new RuntimeError("[main_tree_to_execute] was not specified correctly, and more "
                             + "than one <BehaviorTree> is registered");
    }
    Element rootElement = factory.treeDefinitions().get(mainId);
    if(rootElement == null)
    {
      throw new RuntimeError("Can't find a <BehaviorTree ID=\"" + mainId + "\">");
    }

    this.tree = new Tree();
    Blackboard bb = (rootBlackboard != null) ? rootBlackboard : Blackboard.create();
    tree.rootBlackboard = bb;
    tree.blackboards.add(bb);
    tree.manifests.putAll(factory.manifests());

    Element rootNodeXml = firstChildElement(rootElement);
    tree.rootNode = buildNode(rootNodeXml, bb, "");
    return tree;
  }

  private TreeNode buildNode(Element el, Blackboard bb, String pathPrefix)
  {
    String tag = el.getTagName();
    boolean isSubtreeRef = tag.equals("SubTree");
    String id;
    if(isSubtreeRef)
    {
      id = "SubTree";
    }
    else if(EXPLICIT_TAGS.contains(tag))
    {
      id = el.getAttribute("ID");
      if(id.isEmpty())
      {
        throw new RuntimeError("<" + tag + "> requires an ID attribute");
      }
    }
    else
    {
      id = tag;
    }

    TreeNodeManifest manifest = factory.manifests().get(id);
    if(manifest == null)
    {
      throw new RuntimeError("Node not registered with this factory: [" + id + "]");
    }

    String instanceName = el.hasAttribute("name") ? el.getAttribute("name") : id;
    String path = pathPrefix.isEmpty() ? instanceName : pathPrefix + "/" + instanceName;

    NodeConfig config = new NodeConfig();
    config.blackboard = bb;
    config.uid = nextUid.getAndIncrement();
    config.path = path;

    NamedNodeMap attrs = el.getAttributes();
    for(int i = 0; i < attrs.getLength(); i++)
    {
      Attr a = (Attr) attrs.item(i);
      String attrName = a.getName();
      String attrValue = a.getValue();
      if(attrName.equals("name") || attrName.equals("ID"))
      {
        continue;
      }

      PreCond preCond = matchPreCond(attrName);
      if(preCond != null)
      {
        config.preConditions.put(preCond, attrValue);
        continue;
      }
      PostCond postCond = matchPostCond(attrName);
      if(postCond != null)
      {
        config.postConditions.put(postCond, attrValue);
        continue;
      }

      PortInfo portInfo = manifest.ports.get(attrName);
      if(portInfo != null)
      {
        if(portInfo.direction() != PortDirection.OUTPUT)
        {
          config.inputPorts.put(attrName, attrValue);
        }
        if(portInfo.direction() != PortDirection.INPUT)
        {
          config.outputPorts.put(attrName, attrValue);
        }
      }
      else if(!isSubtreeRef && !NamingUtil.isReservedAttribute(attrName))
      {
        config.otherAttributes.put(attrName, attrValue);
      }
      else if(!isSubtreeRef)
      {
        throw new RuntimeError("A port with name [" + attrName + "] is found in the XML of "
                               + "node [" + path + "] but not in its providedPorts()");
      }
      // for a <SubTree> tag, an attribute that isn't a declared port of the SubTree node type
      // itself (e.g. "_autoremap") is a port-remapping attribute, handled in buildSubtree().
    }

    TreeNode node = factory.instantiateTreeNode(instanceName, id, config);

    if(isSubtreeRef)
    {
      buildSubtree(node, el, bb, path);
      return node;
    }

    List<Element> kids = children(el);
    if(node instanceof ControlNode control)
    {
      for(Element childEl : kids)
      {
        control.addChild(buildNode(childEl, bb, path));
      }
    }
    else if(node instanceof DecoratorNode decorator)
    {
      if(!kids.isEmpty())
      {
        decorator.setChild(buildNode(kids.get(0), bb, path));
      }
    }
    return node;
  }

  private void buildSubtree(TreeNode subtreeNodeUntyped, Element el, Blackboard parentBb,
                            String path)
  {
    var subtreeNode = (org.behaviortree.core.decorators.SubtreeNode) subtreeNodeUntyped;
    String subtreeId = el.getAttribute("ID");
    if(subtreeId.isEmpty())
    {
      throw new RuntimeError("<SubTree> requires an ID attribute");
    }
    subtreeNode.setSubtreeId(subtreeId);

    Element targetTreeEl = factory.treeDefinitions().get(subtreeId);
    if(targetTreeEl == null)
    {
      throw new RuntimeError("Can't find a <BehaviorTree ID=\"" + subtreeId + "\"> referenced "
                             + "by <SubTree> at [" + path + "]");
    }

    Blackboard childBb = Blackboard.create(parentBb);
    tree.blackboards.add(childBb);

    String autoRemapAttr = el.getAttribute("_autoremap");
    boolean autoRemap = autoRemapAttr.equals("1") || autoRemapAttr.equalsIgnoreCase("true");
    childBb.enableAutoRemapping(autoRemap);

    Map<String, String> explicitRemap = new LinkedHashMap<>();
    NamedNodeMap attrs = el.getAttributes();
    for(int i = 0; i < attrs.getLength(); i++)
    {
      Attr a = (Attr) attrs.item(i);
      String name = a.getName();
      if(name.equals("ID") || name.equals("name") || name.equals("_autoremap")
         || NamingUtil.isReservedAttribute(name))
      {
        continue;
      }
      String value = a.getValue();
      if(value.equals("{=}"))
      {
        value = "{" + name + "}";
      }
      explicitRemap.put(name, value);
    }

    PortsList subtreeModel = factory.subtreeModels().get(subtreeId);
    if(subtreeModel != null)
    {
      for(Map.Entry<String, PortInfo> portEntry : subtreeModel.entrySet())
      {
        String portName = portEntry.getKey();
        if(explicitRemap.containsKey(portName) || (autoRemap && !portName.startsWith("_")))
        {
          continue;
        }
        if(!portEntry.getValue().hasDefaultValue())
        {
          throw new RuntimeError("Tree [" + subtreeId + "] is defining a mandatory port ["
                                 + portName + "] and you are not remapping it in the parent's "
                                 + "<SubTree> tag at [" + path + "]");
        }
      }
    }

    for(Map.Entry<String, String> e : explicitRemap.entrySet())
    {
      String value = e.getValue();
      if(TreeNode.isBlackboardPointer(value))
      {
        childBb.addSubtreeRemapping(e.getKey(), TreeNode.stripBlackboardPointer(value));
      }
      else
      {
        childBb.set(e.getKey(), inferLiteralValue(value));
      }
    }

    Element rootChildEl = firstChildElement(targetTreeEl);
    TreeNode childRoot = buildNode(rootChildEl, childBb, path);
    subtreeNode.setChild(childRoot);
  }

  private static Object inferLiteralValue(String value)
  {
    try
    {
      long l = Long.parseLong(value);
      if(l >= Integer.MIN_VALUE && l <= Integer.MAX_VALUE)
      {
        return (int) l;
      }
      return l;
    }
    catch(NumberFormatException ignored)
    {
      // not an integer
    }
    try
    {
      return Double.parseDouble(value);
    }
    catch(NumberFormatException ignored)
    {
      // not a number at all
    }
    return value;
  }

  private static PreCond matchPreCond(String attrName)
  {
    for(PreCond c : PreCond.values())
    {
      if(c.attributeName().equals(attrName))
      {
        return c;
      }
    }
    return null;
  }

  private static PostCond matchPostCond(String attrName)
  {
    for(PostCond c : PostCond.values())
    {
      if(c.attributeName().equals(attrName))
      {
        return c;
      }
    }
    return null;
  }

  private static List<Element> children(Element el)
  {
    List<Element> out = new ArrayList<>();
    NodeList nl = el.getChildNodes();
    for(int i = 0; i < nl.getLength(); i++)
    {
      Node n = nl.item(i);
      if(n.getNodeType() == Node.ELEMENT_NODE)
      {
        out.add((Element) n);
      }
    }
    return out;
  }

  private static Element firstChildElement(Element el)
  {
    for(Element c : children(el))
    {
      return c;
    }
    throw new RuntimeError("<" + el.getTagName() + "> has no child node");
  }
}
