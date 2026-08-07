package org.behaviortree.core.controls;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.List;
import org.behaviortree.core.Blackboard;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.SimpleActionNode;
import org.behaviortree.core.TestActionNode;
import org.behaviortree.core.TreeNode;
import org.junit.jupiter.api.Test;

class ControlNodesTest
{
  private static NodeConfig config()
  {
    NodeConfig c = new NodeConfig();
    c.blackboard = Blackboard.create();
    return c;
  }

  /** Returns SUCCESS/FAILURE on the Nth tick, RUNNING before that, recording each tick. */
  private static TreeNode scripted(String name, List<String> log, NodeStatus[] statuses)
  {
    int[] count = { 0 };
    return new SimpleActionNode(name, node -> {
      log.add(name);
      NodeStatus s = statuses[Math.min(count[0], statuses.length - 1)];
      count[0]++;
      return s;
    }, config());
  }

  @Test
  void sequenceRunsChildrenInOrderUntilFailure()
  {
    List<String> log = new ArrayList<>();
    SequenceNode seq = new SequenceNode("seq", config());
    seq.addChild(scripted("A", log, new NodeStatus[] { NodeStatus.SUCCESS }));
    seq.addChild(scripted("B", log, new NodeStatus[] { NodeStatus.FAILURE }));
    seq.addChild(scripted("C", log, new NodeStatus[] { NodeStatus.SUCCESS }));

    assertEquals(NodeStatus.FAILURE, seq.executeTick());
    assertEquals(List.of("A", "B"), log);
  }

  @Test
  void sequenceRestartsFromFirstChildAfterFailure()
  {
    Blackboard bb = Blackboard.create();
    NodeConfig cfg = new NodeConfig();
    cfg.blackboard = bb;
    SequenceNode seq = new SequenceNode("seq", cfg);
    List<String> log = new ArrayList<>();
    // A always succeeds, B fails once then succeeds.
    seq.addChild(scripted("A", log, new NodeStatus[] { NodeStatus.SUCCESS }));
    int[] bCount = { 0 };
    seq.addChild(new SimpleActionNode("B", node -> {
      log.add("B");
      return bCount[0]++ == 0 ? NodeStatus.FAILURE : NodeStatus.SUCCESS;
    }, cfg));

    assertEquals(NodeStatus.FAILURE, seq.executeTick());
    log.clear();
    assertEquals(NodeStatus.SUCCESS, seq.executeTick());
    assertEquals(List.of("A", "B"), log); // restarted from A, not resumed at B
  }

  @Test
  void fallbackSucceedsOnFirstSuccessfulChild()
  {
    List<String> log = new ArrayList<>();
    FallbackNode fb = new FallbackNode("fb", config());
    fb.addChild(scripted("A", log, new NodeStatus[] { NodeStatus.FAILURE }));
    fb.addChild(scripted("B", log, new NodeStatus[] { NodeStatus.SUCCESS }));
    fb.addChild(scripted("C", log, new NodeStatus[] { NodeStatus.SUCCESS }));

    assertEquals(NodeStatus.SUCCESS, fb.executeTick());
    assertEquals(List.of("A", "B"), log);
  }

  @Test
  void reactiveSequenceReTicksFromStartEveryTime()
  {
    NodeConfig cfg = config();
    ReactiveSequence rs = new ReactiveSequence("rs", cfg);
    List<String> log = new ArrayList<>();
    rs.addChild(scripted("Cond", log, new NodeStatus[] { NodeStatus.SUCCESS }));
    int[] count = { 0 };
    rs.addChild(new TestActionNode("Work", cfg, node -> {
      log.add("Work");
      return count[0]++ == 0 ? NodeStatus.RUNNING : NodeStatus.SUCCESS;
    }));

    assertEquals(NodeStatus.RUNNING, rs.executeTick());
    assertEquals(List.of("Cond", "Work"), log);
    log.clear();
    assertEquals(NodeStatus.SUCCESS, rs.executeTick());
    // Cond is re-ticked even though it already succeeded before.
    assertEquals(List.of("Cond", "Work"), log);
  }

  @Test
  void parallelSucceedsAsSoonAsThresholdReached()
  {
    NodeConfig cfg = config();
    ParallelNode p = new ParallelNode("p");
    p.setSuccessThreshold(2);
    p.setFailureThreshold(3);
    List<String> log = new ArrayList<>();
    p.addChild(scripted("A", log, new NodeStatus[] { NodeStatus.SUCCESS }));
    p.addChild(scripted("B", log, new NodeStatus[] { NodeStatus.SUCCESS }));
    p.addChild(new TestActionNode("C", cfg, node -> {
      log.add("C");
      return NodeStatus.RUNNING;
    }));

    // Threshold (2 successes) is reached as soon as B finishes, so C is never ticked this round.
    assertEquals(NodeStatus.SUCCESS, p.executeTick());
    assertEquals(List.of("A", "B"), log);
  }

  @Test
  void parallelKeepsRunningUntilThresholdReachable()
  {
    NodeConfig cfg = config();
    ParallelNode p = new ParallelNode("p");
    p.setSuccessThreshold(3);
    p.setFailureThreshold(3);
    List<String> log = new ArrayList<>();
    p.addChild(scripted("A", log, new NodeStatus[] { NodeStatus.SUCCESS }));
    p.addChild(scripted("B", log, new NodeStatus[] { NodeStatus.SUCCESS }));
    p.addChild(new TestActionNode("C", cfg, node -> {
      log.add("C");
      return NodeStatus.RUNNING;
    }));

    assertEquals(NodeStatus.RUNNING, p.executeTick());
    assertEquals(List.of("A", "B", "C"), log);
  }

  @Test
  void switchNodeTicksMatchingCaseOnly()
  {
    NodeConfig cfg = config();
    cfg.blackboard.set("var", "42");
    cfg.inputPorts.put("variable", "{var}");
    cfg.inputPorts.put("case_1", "1");
    cfg.inputPorts.put("case_2", "42");
    SwitchNode sw = new SwitchNode("sw", cfg, 2);
    List<String> log = new ArrayList<>();
    sw.addChild(scripted("Case1", log, new NodeStatus[] { NodeStatus.SUCCESS }));
    sw.addChild(scripted("Case2", log, new NodeStatus[] { NodeStatus.SUCCESS }));
    sw.addChild(scripted("Default", log, new NodeStatus[] { NodeStatus.SUCCESS }));

    assertEquals(NodeStatus.SUCCESS, sw.executeTick());
    assertEquals(List.of("Case2"), log);
  }
}
