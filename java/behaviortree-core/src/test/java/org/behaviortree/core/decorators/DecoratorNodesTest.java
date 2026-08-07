package org.behaviortree.core.decorators;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.behaviortree.core.Blackboard;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.SimpleActionNode;
import org.behaviortree.core.TestActionNode;
import org.junit.jupiter.api.Test;

class DecoratorNodesTest
{
  private static NodeConfig config()
  {
    NodeConfig c = new NodeConfig();
    c.blackboard = Blackboard.create();
    return c;
  }

  @Test
  void inverterSwapsSuccessAndFailure()
  {
    NodeConfig cfg = config();
    InverterNode inv = new InverterNode("inv", cfg);
    inv.setChild(new SimpleActionNode("child", node -> NodeStatus.SUCCESS, cfg));
    assertEquals(NodeStatus.FAILURE, inv.executeTick());
  }

  @Test
  void retryStopsAfterMaxAttempts()
  {
    NodeConfig cfg = config();
    RetryNode retry = new RetryNode("retry", 3);
    int[] attempts = { 0 };
    retry.setChild(new SimpleActionNode("child", node -> {
      attempts[0]++;
      return NodeStatus.FAILURE;
    }, cfg));

    assertEquals(NodeStatus.FAILURE, retry.executeTick());
    assertEquals(3, attempts[0]);
  }

  @Test
  void retrySucceedsAndResetsCounter()
  {
    NodeConfig cfg = config();
    RetryNode retry = new RetryNode("retry", 5);
    int[] attempts = { 0 };
    retry.setChild(new SimpleActionNode("child", node -> {
      attempts[0]++;
      return attempts[0] < 3 ? NodeStatus.FAILURE : NodeStatus.SUCCESS;
    }, cfg));

    assertEquals(NodeStatus.SUCCESS, retry.executeTick());
    assertEquals(3, attempts[0]);
  }

  @Test
  void repeatStopsImmediatelyOnFailure()
  {
    NodeConfig cfg = config();
    RepeatNode repeat = new RepeatNode("repeat", 5);
    int[] count = { 0 };
    repeat.setChild(new SimpleActionNode("child", node -> {
      count[0]++;
      return count[0] < 2 ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
    }, cfg));

    assertEquals(NodeStatus.FAILURE, repeat.executeTick());
    assertEquals(2, count[0]);
  }

  @Test
  void forceSuccessConvertsFailureToSuccess()
  {
    NodeConfig cfg = config();
    ForceSuccessNode fs = new ForceSuccessNode("fs", cfg);
    fs.setChild(new SimpleActionNode("child", node -> NodeStatus.FAILURE, cfg));
    assertEquals(NodeStatus.SUCCESS, fs.executeTick());
  }

  @Test
  void keepRunningUntilFailureLoopsOnSuccess()
  {
    NodeConfig cfg = config();
    KeepRunningUntilFailureNode k = new KeepRunningUntilFailureNode("k", cfg);
    int[] count = { 0 };
    k.setChild(new SimpleActionNode("child", node -> {
      count[0]++;
      return count[0] < 3 ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
    }, cfg));

    assertEquals(NodeStatus.RUNNING, k.executeTick());
    assertEquals(NodeStatus.RUNNING, k.executeTick());
    assertEquals(NodeStatus.FAILURE, k.executeTick());
    assertEquals(3, count[0]);
  }

  @Test
  void timeoutFailsAndHaltsChildAfterDeadline() throws InterruptedException
  {
    NodeConfig cfg = config();
    cfg.inputPorts.put("msec", "20");
    TimeoutNode timeout = new TimeoutNode("timeout", cfg);
    timeout.setChild(new TestActionNode("child", cfg, node -> NodeStatus.RUNNING));
    assertEquals(NodeStatus.RUNNING, timeout.executeTick());
    Thread.sleep(40);
    assertEquals(NodeStatus.FAILURE, timeout.executeTick());
  }

  @Test
  void runOnceTicksChildOnlyOnce()
  {
    NodeConfig cfg = config();
    RunOnceNode runOnce = new RunOnceNode("ro", cfg);
    int[] count = { 0 };
    runOnce.setChild(new SimpleActionNode("child", node -> {
      count[0]++;
      return NodeStatus.SUCCESS;
    }, cfg));

    assertEquals(NodeStatus.SUCCESS, runOnce.executeTick());
    assertEquals(NodeStatus.SKIPPED, runOnce.executeTick());
    assertEquals(NodeStatus.SKIPPED, runOnce.executeTick());
    assertEquals(1, count[0]);
  }
}
