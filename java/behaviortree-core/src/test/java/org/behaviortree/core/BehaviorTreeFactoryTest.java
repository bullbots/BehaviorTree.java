package org.behaviortree.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class BehaviorTreeFactoryTest
{
  /** A trivial custom action, registered like a user would register their own robot code. */
  public static class MoveAction extends SyncActionNode
  {
    public static int callCount = 0;

    public MoveAction(String name, NodeConfig config)
    {
      super(name, config);
    }

    public static PortsList providedPorts()
    {
      return Port.list(Port.input(Double.class, "distance"));
    }

    @Override
    protected NodeStatus tick()
    {
      callCount++;
      double d = getInput("distance", Double.class);
      return d > 0 ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
    }
  }

  @Test
  void simpleSequenceFromXml()
  {
    BehaviorTreeFactory factory = new BehaviorTreeFactory();
    factory.registerNodeType("MoveAction", MoveAction.class);
    MoveAction.callCount = 0;

    String xml = """
        <root BTCPP_format="4" main_tree_to_execute="MainTree">
          <BehaviorTree ID="MainTree">
            <Sequence>
              <MoveAction distance="1.0"/>
              <MoveAction distance="2.0"/>
            </Sequence>
          </BehaviorTree>
        </root>
        """;

    Tree tree = factory.createTreeFromText(xml);
    assertEquals(NodeStatus.SUCCESS, tree.tickOnce());
    assertEquals(2, MoveAction.callCount);
  }

  @Test
  void singleRegisteredTreeIsUsedWithoutMainAttribute()
  {
    BehaviorTreeFactory factory = new BehaviorTreeFactory();
    String xml = """
        <root BTCPP_format="4">
          <BehaviorTree ID="OnlyTree">
            <AlwaysSuccess/>
          </BehaviorTree>
        </root>
        """;
    Tree tree = factory.createTreeFromText(xml);
    assertEquals(NodeStatus.SUCCESS, tree.tickOnce());
  }

  @Test
  void compactAndExplicitFormsAreEquivalent()
  {
    BehaviorTreeFactory factory = new BehaviorTreeFactory();
    String xml = """
        <root BTCPP_format="4" main_tree_to_execute="MainTree">
          <BehaviorTree ID="MainTree">
            <Fallback>
              <Action ID="AlwaysFailure"/>
              <AlwaysSuccess/>
            </Fallback>
          </BehaviorTree>
        </root>
        """;
    Tree tree = factory.createTreeFromText(xml);
    assertEquals(NodeStatus.SUCCESS, tree.tickOnce());
  }

  @Test
  void portRemappingThroughBlackboard()
  {
    BehaviorTreeFactory factory = new BehaviorTreeFactory();
    String xml = """
        <root BTCPP_format="4" main_tree_to_execute="MainTree">
          <BehaviorTree ID="MainTree">
            <Sequence>
              <Script code="dist:=5.0"/>
              <SetBlackboard value="{dist}" output_key="finalDist"/>
            </Sequence>
          </BehaviorTree>
        </root>
        """;
    Blackboard bb = Blackboard.create();
    Tree tree = factory.createTreeFromText(xml, bb);
    assertEquals(NodeStatus.SUCCESS, tree.tickOnce());
    assertEquals(5.0, bb.get("finalDist", Double.class));
  }

  @Test
  void subtreeExplicitRemapping()
  {
    BehaviorTreeFactory factory = new BehaviorTreeFactory();
    // "param" is remapped in (parent myParam -> child param), "heard" is remapped back out
    // (child heard -> parent finalHeard), exercising both directions of explicit remapping.
    String xml = """
        <root BTCPP_format="4" main_tree_to_execute="MainTree">
          <BehaviorTree ID="MainTree">
            <Sequence>
              <Script code="myParam:='Hello'"/>
              <SubTree ID="Talk" param="{myParam}" heard="{finalHeard}"/>
            </Sequence>
          </BehaviorTree>
          <BehaviorTree ID="Talk">
            <SetBlackboard value="{param}" output_key="heard"/>
          </BehaviorTree>
        </root>
        """;
    Blackboard bb = Blackboard.create();
    Tree tree = factory.createTreeFromText(xml, bb);
    assertEquals(NodeStatus.SUCCESS, tree.tickOnce());
    assertEquals("Hello", bb.get("finalHeard", String.class));
  }

  @Test
  void subtreeAutoremap()
  {
    BehaviorTreeFactory factory = new BehaviorTreeFactory();
    String xml = """
        <root BTCPP_format="4" main_tree_to_execute="MainTree">
          <BehaviorTree ID="MainTree">
            <Sequence>
              <Script code="param:='Auto remapped'"/>
              <SubTree ID="Talk" _autoremap="1"/>
            </Sequence>
          </BehaviorTree>
          <BehaviorTree ID="Talk">
            <SetBlackboard value="{param}" output_key="heard"/>
          </BehaviorTree>
        </root>
        """;
    Blackboard bb = Blackboard.create();
    Tree tree = factory.createTreeFromText(xml, bb);
    assertEquals(NodeStatus.SUCCESS, tree.tickOnce());
    assertEquals("Auto remapped", bb.get("heard", String.class));
  }

  @Test
  void skipIfPreconditionSkipsNodeWithoutTicking()
  {
    BehaviorTreeFactory factory = new BehaviorTreeFactory();
    MoveAction.callCount = 0;
    String xml = """
        <root BTCPP_format="4" main_tree_to_execute="MainTree">
          <BehaviorTree ID="MainTree">
            <MoveAction distance="1.0" _skipIf="skip_it"/>
          </BehaviorTree>
        </root>
        """;
    factory.registerNodeType("MoveAction", MoveAction.class);
    Blackboard bb = Blackboard.create();
    bb.set("skip_it", true);
    Tree tree = factory.createTreeFromText(xml, bb);
    assertEquals(NodeStatus.SKIPPED, tree.tickOnce());
    assertEquals(0, MoveAction.callCount);
  }

  @Test
  void unregisteredNodeThrowsHelpfulError()
  {
    BehaviorTreeFactory factory = new BehaviorTreeFactory();
    String xml = """
        <root BTCPP_format="4" main_tree_to_execute="MainTree">
          <BehaviorTree ID="MainTree">
            <ThisDoesNotExist/>
          </BehaviorTree>
        </root>
        """;
    assertThrows(RuntimeError.class, () -> factory.createTreeFromText(xml));
  }

  @Test
  void mandatorySubtreePortWithoutRemappingOrDefaultThrows()
  {
    BehaviorTreeFactory factory = new BehaviorTreeFactory();
    String xml = """
        <root BTCPP_format="4" main_tree_to_execute="MainTree">
          <BehaviorTree ID="MainTree">
            <SubTree ID="Talk"/>
          </BehaviorTree>
          <BehaviorTree ID="Talk">
            <SetBlackboard value="{param}" output_key="heard"/>
          </BehaviorTree>
          <TreeNodesModel>
            <SubTree ID="Talk">
              <input_port name="param"/>
            </SubTree>
          </TreeNodesModel>
        </root>
        """;
    assertThrows(RuntimeError.class, () -> factory.createTreeFromText(xml));
  }
}
