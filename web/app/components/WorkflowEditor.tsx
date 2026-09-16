'use client';

import React, { useCallback } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  BackgroundVariant,
  Handle,
  Position,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Bot, CirclePlay, CircleStop, Download, GitBranch, Plus, RefreshCw, Save, Wrench } from 'lucide-react';
import { apiBaseUrl, apiRequest, isAbortError } from '../../lib/api';
import { useAuth } from './AuthProvider';

// 强制显示 edge 的样式
const edgeStyles = `
  .react-flow__edge-path {
    stroke: #4f46e5 !important;
    stroke-width: 3px !important;
    stroke-linecap: round !important;
    vector-effect: non-scaling-stroke !important;
    fill: none !important;
  }
  .react-flow__edges {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    z-index: 2 !important;
    overflow: visible !important;
  }
  .react-flow__edges > svg:not(.react-flow__marker) {
    width: 100% !important;
    height: 100% !important;
    overflow: visible !important;
  }
  .react-flow__edge { z-index: 3 !important; }
  .react-flow__edge {
    pointer-events: all !important;
  }
  .react-flow__node {
    z-index: 5 !important;
  }
`;
import { Language } from '../../lib/i18n';

type WorkflowNode = {
  id: string;
  type: string;
  label: string;
  config?: Record<string, unknown>;
};

type WorkflowEdge = {
  source: string;
  target: string;
  condition?: string;
  sourceHandle?: string;
};

type AvailableTool = {
  id: string;
  name: string;
  description: string;
  executor: string;
  risk_level: string;
};

type Props = {
  initialNodes: WorkflowNode[];
  initialEdges: WorkflowEdge[];
  onSave: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => Promise<void>;
  language: Language;
};

type ValidationErrors = Record<string, string>;

// 自定义节点样式
const nodeStyle = {
  padding: '16px 24px',
  borderRadius: '8px',
  border: '2px solid',
  fontSize: '14px',
  fontWeight: 600,
  minWidth: '160px',
  textAlign: 'center' as const,
};

const StartNode = ({ data }: { data: { label: string } }) => (
  <div style={{ ...nodeStyle, borderColor: '#10b981', background: '#ecfdf5', color: '#065f46' }}>
    <CirclePlay size={16} aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6 }} />{data.label}
    <Handle type="source" position={Position.Bottom} />
  </div>
);

const EndNode = ({ data }: { data: { label: string } }) => (
  <div style={{ ...nodeStyle, borderColor: '#ef4444', background: '#fef2f2', color: '#991b1b' }}>
    <Handle type="target" position={Position.Top} />
    <CircleStop size={16} aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6 }} />{data.label}
  </div>
);

const PrepareNode = ({ data }: { data: { label: string } }) => (
  <div style={{ ...nodeStyle, borderColor: '#10b981', background: '#f0fdf4', color: '#065f46' }}>
    <Handle type="target" position={Position.Top} />
    <Download size={16} aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6 }} />{data.label}
    <Handle type="source" position={Position.Bottom} />
  </div>
);

const ModelNode = ({ data }: { data: { label: string } }) => (
  <div style={{ ...nodeStyle, borderColor: '#667eea', background: '#eef2ff', color: '#3730a3' }}>
    <Handle type="target" position={Position.Top} />
    <Bot size={16} aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6 }} />{data.label}
    <Handle type="source" position={Position.Bottom} />
  </div>
);

const ToolNode = ({ data }: { data: { label: string } }) => (
  <div style={{ ...nodeStyle, borderColor: '#8b5cf6', background: '#faf5ff', color: '#5b21b6' }}>
    <Handle type="target" position={Position.Top} />
    <Wrench size={16} aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6 }} />{data.label}
    <Handle type="source" position={Position.Bottom} />
  </div>
);

const ConditionNode = ({ data }: { data: { label: string } }) => (
  <div style={{ ...nodeStyle, borderColor: '#f59e0b', background: '#fffbeb', color: '#92400e' }}>
    <Handle type="target" position={Position.Top} />
    <GitBranch size={16} aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6 }} />{data.label}
    <Handle type="source" position={Position.Bottom} id="true" style={{ left: '30%' }} />
    <Handle type="source" position={Position.Bottom} id="false" style={{ left: '70%' }} />
  </div>
);

const FinalizeNode = ({ data }: { data: { label: string } }) => (
  <div style={{ ...nodeStyle, borderColor: '#ef4444', background: '#fef2f2', color: '#991b1b' }}>
    <Handle type="target" position={Position.Top} />
    <Download size={16} aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6, transform: 'rotate(180deg)' }} />{data.label}
    <Handle type="source" position={Position.Bottom} />
  </div>
);

const nodeTypes: NodeTypes = {
  start: StartNode,
  end: EndNode,
  prepare: PrepareNode,
  model: ModelNode,
  tool: ToolNode,
  condition: ConditionNode,
  finalize: FinalizeNode,
};

const nodeTypeLabels: Record<string, { zh: string; en: string }> = {
  start: { zh: '开始', en: 'Start' },
  end: { zh: '结束', en: 'End' },
  prepare: { zh: '准备', en: 'Prepare' },
  model: { zh: '模型', en: 'Model' },
  tool: { zh: '工具', en: 'Tool' },
  condition: { zh: '条件', en: 'Condition' },
  finalize: { zh: '完成', en: 'Finalize' },
};

const getNodeLabel = (type: string, index: number, language: Language, toolName?: string) => {
  const label = nodeTypeLabels[type] || { zh: type, en: type };
  const base = language === 'zh' ? `${label.zh}（${index}）` : `${label.en} ${index}`;
  return type === 'tool' && toolName ? `${base}：${toolName}` : base;
};

// 转换格式：后端格式 → ReactFlow 格式
const convertToReactFlowNodes = (workflowNodes: WorkflowNode[]): Node[] => {
  return workflowNodes.map((node, index) => ({
    id: node.id,
    type: node.type || 'default',
    position: { x: 250, y: index * 120 + 50 }, // 垂直排列
    data: {
      label: node.label,
      // Older API responses expose runtime fields at the node root while
      // newer editor responses keep them in config. Merge both shapes so the
      // property panel can edit either version without losing data.
      config: {
        ...(Object.fromEntries(Object.entries(node).filter(([key]) => !['id', 'type', 'label', 'config'].includes(key)))),
        ...(node.config ?? {}),
      },
    },
  }));
};

const convertToReactFlowEdges = (workflowEdges: WorkflowEdge[]): Edge[] => {
  const reactFlowEdges = workflowEdges.map((edge, index) => ({
    id: `e${index}-${edge.source}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? edge.condition,
    label: edge.condition,
    animated: true,
    style: {
      stroke: '#667eea',
      strokeWidth: 3,
      opacity: 1,
      strokeDasharray: '0'
    },
    type: 'smoothstep',
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: '#667eea',
    },
  }));
  return reactFlowEdges;
};

// 转换格式：ReactFlow 格式 → 后端格式
const convertFromReactFlow = (
  nodes: Node[],
  edges: Edge[]
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } => {
  const workflowNodes = nodes.map((node) => ({
    id: node.id,
    type: node.type || 'default',
    label: (node.data.label as string) || node.id,
    config: (node.data.config as Record<string, unknown>) || {},
  }));

  const workflowEdges = edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    condition: edge.sourceHandle ?? (edge.label ? String(edge.label) : undefined),
    sourceHandle: edge.sourceHandle ?? undefined,
  }));

  return { nodes: workflowNodes, edges: workflowEdges };
};

export default function WorkflowEditor({ initialNodes, initialEdges, onSave, language }: Props) {
  const { token } = useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState(convertToReactFlowNodes(initialNodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(convertToReactFlowEdges(initialEdges));
  const [selectedNodeType, setSelectedNodeType] = React.useState<string>('prepare');
  const [availableTools, setAvailableTools] = React.useState<AvailableTool[]>([]);
  const [selectedToolId, setSelectedToolId] = React.useState('');
  const [toolsLoading, setToolsLoading] = React.useState(false);
  const [toolsError, setToolsError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [toolInputDraft, setToolInputDraft] = React.useState('{}');
  const [toolInputError, setToolInputError] = React.useState('');
  const [validationErrors, setValidationErrors] = React.useState<ValidationErrors>({});

  const selectedNode = selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) ?? null : null;
  const selectedNodeTypeLabel = selectedNode ? (nodeTypeLabels[selectedNode.type || ''] ? (language === 'zh' ? nodeTypeLabels[selectedNode.type || ''].zh : nodeTypeLabels[selectedNode.type || ''].en) : selectedNode.type) : '';
  const fieldError = (field: string) => selectedNode ? validationErrors[`${selectedNode.id}.${field}`] : undefined;

  const updateSelectedConfig = (updates: Record<string, unknown>) => {
    if (!selectedNode) return;
    setNodes((currentNodes) => currentNodes.map((node) => {
      if (node.id !== selectedNode.id) return node;
      const config = {...((node.data.config as Record<string, unknown> | undefined) ?? {}), ...updates};
      const toolName = typeof config.tool_name === 'string' ? config.tool_name : undefined;
      const index = currentNodes.filter((item) => item.type === node.type).findIndex((item) => item.id === node.id) + 1;
      return {
        ...node,
        data: {
          ...node.data,
          config,
          label: getNodeLabel(node.type || 'default', index, language, toolName),
        },
      };
    }));
    if (selectedNode) {
      setValidationErrors((current) => {
        const next = { ...current };
        Object.keys(updates).forEach((field) => delete next[`${selectedNode.id}.${field}`]);
        return next;
      });
    }
  };

  const updateConditionBranch = (branch: 'true' | 'false', target: string) => {
    if (!selectedNode) return;
    updateSelectedConfig({[`${branch}_next`]: target});
    setEdges((currentEdges) => {
      const retained = currentEdges.filter((edge) => !(edge.source === selectedNode.id && edge.sourceHandle === branch));
      if (!target) return retained;
      return addEdge({
        id: `e-${selectedNode.id}-${branch}-${target}`,
        source: selectedNode.id,
        sourceHandle: branch,
        target,
        label: branch,
        type: 'smoothstep',
        markerEnd: {type: MarkerType.ArrowClosed, color: '#667eea'},
      }, retained);
    });
  };

  const removeSelectedNode = () => {
    if (!selectedNode || selectedNode.type === 'start' || selectedNode.type === 'end') return;
    const incoming = edges.filter((edge) => edge.target === selectedNode.id);
    const outgoing = edges.filter((edge) => edge.source === selectedNode.id);
    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== selectedNode.id));
    setEdges((currentEdges) => {
      const retained = currentEdges.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id);
      const bridges = incoming.flatMap((entry) => outgoing.map((exit, index) => ({
        id: `e-bridge-${entry.source}-${exit.target}-${index}`,
        source: entry.source,
        target: exit.target,
        type: 'smoothstep',
        animated: true,
        markerEnd: {type: MarkerType.ArrowClosed, color: '#667eea'},
      })));
      return [...retained, ...bridges];
    });
    setSelectedNodeId(null);
  };

  const loadTools = useCallback(async (signal?: AbortSignal) => {
    if (!token) return;
    setToolsLoading(true);
    setToolsError('');
    try {
      const result = await apiRequest<AvailableTool[]>(apiBaseUrl, '/api/v1/tools?limit=100', token, { signal });
      const items = result.data ?? [];
      setAvailableTools(items);
      setSelectedToolId((current) => items.some((tool) => tool.id === current) ? current : (items[0]?.id ?? ''));
    } catch (cause) {
      if (!isAbortError(cause)) setToolsError(language === 'zh' ? '工具列表加载失败' : 'Failed to load tools');
    } finally {
      if (!signal?.aborted) setToolsLoading(false);
    }
  }, [language, token]);

  React.useEffect(() => {
    const controller = new AbortController();
    void loadTools(controller.signal);
    return () => controller.abort();
  }, [loadTools]);

  // 当 initialNodes 或 initialEdges 变化时，重新同步
  React.useEffect(() => {
    setNodes(convertToReactFlowNodes(initialNodes));
    setEdges(convertToReactFlowEdges(initialEdges));
  }, [initialNodes, initialEdges]);  // 移除 setNodes 和 setEdges 依赖

  React.useEffect(() => {
    setNodes((currentNodes) => {
      const typeCounters: Record<string, number> = {};
      return currentNodes.map((node) => {
        if (node.type === 'start' || node.type === 'end') {
          const baseLabel = nodeTypeLabels[node.type] || { zh: node.type, en: node.type };
          return { ...node, data: { ...node.data, label: language === 'zh' ? baseLabel.zh : baseLabel.en } };
        }
        typeCounters[node.type || 'default'] = (typeCounters[node.type || 'default'] || 0) + 1;
        const config = node.data.config as Record<string, unknown> | undefined;
        const toolName = typeof config?.tool_name === 'string' ? config.tool_name : undefined;
        return { ...node, data: { ...node.data, label: getNodeLabel(node.type || 'default', typeCounters[node.type || 'default'], language, toolName) } };
      });
    });
  }, [language, setNodes]);

  React.useEffect(() => {
    if (selectedNodeId && !nodes.some((node) => node.id === selectedNodeId)) setSelectedNodeId(null);
  }, [nodes, selectedNodeId]);

  React.useEffect(() => {
    if (selectedNode?.type === 'tool') {
      const input = (selectedNode.data.config as Record<string, unknown> | undefined)?.input ?? {};
      setToolInputDraft(JSON.stringify(input, null, 2));
      setToolInputError('');
    }
  }, [selectedNode?.id, selectedNode?.type]);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        animated: true,
        style: {
          stroke: '#667eea',
          strokeWidth: 3,
          opacity: 1
        },
        type: 'smoothstep',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#667eea',
        },
      };
      setEdges((eds) => {
        return addEdge(newEdge, eds);
      });
    },
    [setEdges]
  );

  const addNode = () => {
    const selectedTool = availableTools.find((tool) => tool.id === selectedToolId);
    if (selectedNodeType === 'tool' && !selectedTool) return;
    const newId = `node-${Date.now()}`;
    const typeIndex = nodes.filter((node) => node.type === selectedNodeType).length + 1;
    const config = selectedNodeType === 'tool' && selectedTool
      ? { tool_id: selectedTool.id, tool_name: selectedTool.name }
      : selectedNodeType === 'condition'
        ? { condition_type: 'comparison', operator: 'equals' }
        : {};
    const newNode: Node = {
      id: newId,
      type: selectedNodeType,
      position: { x: 250, y: nodes.length * 120 + 50 },
      data: { label: getNodeLabel(selectedNodeType, typeIndex, language, selectedTool?.name), config },
    };
    setNodes((nds) => [...nds, newNode]);
    setEdges((currentEdges) => {
      const endNode = nodes.find((node) => node.type === 'end');
      if (!endNode) return currentEdges;
      const incoming = currentEdges.filter((edge) => edge.target === endNode.id);
      const retained = currentEdges.filter((edge) => edge.target !== endNode.id);
      const incomingToNew = incoming.map((edge, index) => ({
        ...edge,
        id: `e-insert-${newId}-${index}`,
        target: newId,
      }));
      return [
        ...retained,
        ...incomingToNew,
        { id: `e-${newId}-${endNode.id}`, source: newId, target: endNode.id },
      ];
    });
  };

  const validateWorkflow = (converted: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }) => {
    const errors: ValidationErrors = {};
    converted.nodes.forEach((node) => {
      const config = node.config ?? {};
      const key = (field: string) => `${node.id}.${field}`;
      if (node.type === 'model' && !String(config.prompt ?? '').trim()) {
        errors[key('prompt')] = '模型 Prompt 不能为空';
      }
      if (node.type === 'tool') {
        if (!String(config.tool_id ?? '').trim()) errors[key('tool_id')] = '请选择一个工具';
        const rawInput = node.id === selectedNode?.id ? toolInputDraft : JSON.stringify(config.input ?? {});
        try {
          const input = JSON.parse(rawInput);
          if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('object required');
          node.config = { ...config, input };
        } catch {
          errors[key('input')] = '输入参数必须是有效的 JSON 对象';
        }
      }
      if (node.type === 'condition') {
        if (!String(config.left ?? '').trim()) errors[key('left')] = '左值字段不能为空';
        if (!String(config.right ?? '').trim()) errors[key('right')] = '右值不能为空';
        if (!String(config.true_next ?? '').trim()) errors[key('true_next')] = '请选择满足时的目标节点';
        if (!String(config.false_next ?? '').trim()) errors[key('false_next')] = '请选择不满足时的目标节点';
      }
    });
    return errors;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const converted = convertFromReactFlow(nodes, edges);
      const errors = validateWorkflow(converted);
      setValidationErrors(errors);
      if (Object.keys(errors).length > 0) {
        const firstInvalidNode = Object.keys(errors)[0]?.split('.')[0];
        if (firstInvalidNode) setSelectedNodeId(firstInvalidNode);
        return;
      }
      await onSave(converted.nodes, converted.edges);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoLayout = () => {
    // 简单的自动布局：垂直排列
    const updatedNodes = nodes.map((node, index) => ({
      ...node,
      position: { x: 250, y: index * 120 + 50 },
    }));
    setNodes(updatedNodes);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* 注入强制显示 edge 的样式 */}
      <style>{edgeStyles}</style>

      {/* 工具栏 */}
      <div className="card workflow-editor-toolbar">
        <div className="workflow-editor-controls">
          <div className="workflow-editor-field">
            <label htmlFor="workflow-node-type">
              {language === 'zh' ? '节点类型:' : 'Node Type:'}
            </label>
            <select
              id="workflow-node-type"
              value={selectedNodeType}
              onChange={(e) => setSelectedNodeType(e.target.value)}
              className="form-input"
            >
              <option value="prepare">{language === 'zh' ? '准备' : 'Prepare'}</option>
              <option value="model">{language === 'zh' ? '模型' : 'Model'}</option>
              <option value="tool">{language === 'zh' ? '工具' : 'Tool'}</option>
              <option value="condition">{language === 'zh' ? '条件' : 'Condition'}</option>
              <option value="finalize">{language === 'zh' ? '完成' : 'Finalize'}</option>
            </select>
          </div>

          {selectedNodeType === 'tool' && (
            <div className="workflow-editor-field workflow-tool-field">
              <label htmlFor="workflow-tool-select">{language === 'zh' ? '已注册工具:' : 'Registered tool:'}</label>
              <select
                id="workflow-tool-select"
                className="form-input"
                value={selectedToolId}
                onChange={(event) => setSelectedToolId(event.target.value)}
                disabled={toolsLoading || Boolean(toolsError) || availableTools.length === 0}
                aria-describedby="workflow-tool-status"
              >
                {availableTools.length === 0 && <option value="">{toolsLoading ? (language === 'zh' ? '加载中...' : 'Loading...') : (language === 'zh' ? '暂无可用工具' : 'No tools available')}</option>}
                {availableTools.map((tool) => <option key={tool.id} value={tool.id}>{tool.name} · {tool.executor}</option>)}
              </select>
            </div>
          )}

          <button className="btn btn-secondary" type="button" onClick={addNode} disabled={selectedNodeType === 'tool' && !selectedToolId}>
            <Plus size={16} aria-hidden="true" />{language === 'zh' ? '添加节点' : 'Add Node'}
          </button>

          <button className="btn btn-secondary" type="button" onClick={handleAutoLayout}>
            <RefreshCw size={16} aria-hidden="true" />{language === 'zh' ? '自动布局' : 'Auto Layout'}
          </button>

          <div style={{ flex: 1 }} />

          <button
            className="btn btn-primary"
            type="button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? (language === 'zh' ? '保存中...' : 'Saving...')
              : <><Save size={16} aria-hidden="true" />{language === 'zh' ? '保存工作流' : 'Save Workflow'}</>}
          </button>
        </div>

        {selectedNodeType === 'tool' && (
          <div id="workflow-tool-status" className={`workflow-tool-status${toolsError ? ' error' : ''}`} role={toolsError ? 'alert' : 'status'}>
            {toolsError ? <><span>{toolsError}</span><button type="button" onClick={() => void loadTools()}>{language === 'zh' ? '重试' : 'Retry'}</button></> : !toolsLoading && availableTools.length === 0 ? <><span>{language === 'zh' ? '请先注册一个工具，再添加工具节点。' : 'Register a tool before adding a tool node.'}</span><a href="/tools/create">{language === 'zh' ? '注册工具' : 'Register tool'}</a></> : selectedToolId ? <span>{language === 'zh' ? '该节点运行时会调用所选工具，并记录调用审计。' : 'This node will call the selected tool and record an audit trail.'}</span> : null}
          </div>
        )}

        <div style={{
          marginTop: 'var(--space-3)',
          padding: 'var(--space-3)',
          background: 'var(--gray-50)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.875rem',
          color: 'var(--text-secondary)'
        }}>
          <strong>{language === 'zh' ? '操作提示:' : 'Instructions:'}</strong>
          <ul style={{ marginTop: 'var(--space-2)', marginLeft: 'var(--space-4)' }}>
            <li>{language === 'zh' ? '拖动节点调整位置' : 'Drag nodes to reposition'}</li>
            <li>{language === 'zh' ? '从一个节点拖动到另一个节点创建连线' : 'Drag from one node to another to create edges'}</li>
            <li>{language === 'zh' ? '点击节点或连线选中后按 Delete 键删除' : 'Select nodes/edges and press Delete to remove'}</li>
            <li>{language === 'zh' ? '使用右侧控制面板缩放和导航' : 'Use controls on the right to zoom and navigate'}</li>
          </ul>
        </div>
      </div>

      {/* ReactFlow 画布 */}
      <div style={{
        padding: 0,
        height: '600px',
        width: '100%',
        border: '1px solid var(--line)',
        borderRadius: '8px',
        overflow: 'hidden',
        position: 'relative'
      }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => setSelectedNodeId(null)}
          deleteKeyCode="Delete"
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={{
            animated: false,
            style: { stroke: '#4f46e5', strokeWidth: 2.5, opacity: 1 },
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed, color: '#4f46e5' },
          }}
          connectionLineStyle={{ stroke: '#4f46e5', strokeWidth: 2.5 }}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1.1 }}
          minZoom={0.5}
          maxZoom={1.5}
          style={{ background: '#fafafa', width: '100%', height: '100%' }}
        >
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              switch (node.type) {
                case 'start': return '#10b981';
                case 'end': return '#ef4444';
                case 'agent': return '#667eea';
                case 'condition': return '#f59e0b';
                default: return '#6b7280';
              }
            }}
            style={{ background: '#fff', border: '1px solid var(--border)' }}
          />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
      </div>

      <section className="card workflow-node-properties" aria-labelledby="workflow-node-properties-title">
        <div className="workflow-properties-heading">
          <div>
            <h3 id="workflow-node-properties-title">节点属性</h3>
            <p>{selectedNode ? `${selectedNodeTypeLabel} · ${selectedNode.id}` : '点击画布中的节点编辑运行参数'}</p>
          </div>
          {selectedNode && selectedNode.type !== 'start' && selectedNode.type !== 'end' && (
            <button className="danger-button icon-text-button" type="button" onClick={removeSelectedNode}>删除节点</button>
          )}
        </div>
        {!selectedNode ? (
          <div className="workflow-properties-empty">未选择节点。开始、结束节点无需配置。</div>
        ) : selectedNode.type === 'start' || selectedNode.type === 'end' ? (
          <div className="workflow-properties-empty">这是流程边界节点，不能配置运行参数。</div>
        ) : (
          <div className="workflow-properties-form">
            {selectedNode.type === 'model' && (
              <label className="workflow-property-wide"><span>模型 Prompt</span><textarea rows={5} aria-invalid={Boolean(fieldError('prompt'))} value={String((selectedNode.data.config as Record<string, unknown> | undefined)?.prompt ?? '')} placeholder="例如：根据用户问题生成简洁、准确的回答" onChange={(event) => updateSelectedConfig({prompt: event.target.value})} /><small className={fieldError('prompt') ? 'workflow-field-error' : undefined} role={fieldError('prompt') ? 'alert' : undefined}>{fieldError('prompt') || '运行时会把 {prompt} 替换为用户输入。'}</small></label>
            )}
            {selectedNode.type === 'tool' && (
              <>
                <label><span>工具</span><select aria-invalid={Boolean(fieldError('tool_id'))} value={String((selectedNode.data.config as Record<string, unknown> | undefined)?.tool_id ?? '')} onChange={(event) => { const tool = availableTools.find((item) => item.id === event.target.value); updateSelectedConfig({tool_id: event.target.value, tool_name: tool?.name ?? ''}); }} disabled={toolsLoading || availableTools.length === 0}>{availableTools.map((tool) => <option key={tool.id} value={tool.id}>{tool.name}</option>)}</select>{fieldError('tool_id') && <small className="workflow-field-error" role="alert">{fieldError('tool_id')}</small>}</label>
                <label className="workflow-property-wide"><span>输入参数 JSON</span><textarea rows={5} value={toolInputDraft} aria-invalid={Boolean(toolInputError || fieldError('input'))} onChange={(event) => { setToolInputDraft(event.target.value); setToolInputError(''); setValidationErrors((current) => { const next = { ...current }; delete next[`${selectedNode.id}.input`]; return next; }); }} onBlur={() => { try { const input = JSON.parse(toolInputDraft); if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(); updateSelectedConfig({input}); setToolInputError(''); } catch { setToolInputError('输入参数必须是有效的 JSON 对象'); } }} /><small className={toolInputError || fieldError('input') ? 'workflow-field-error' : undefined}>{toolInputError || fieldError('input') || '必须是 JSON 对象；失焦时校验格式。'}</small></label>
              </>
            )}
            {selectedNode.type === 'condition' && (() => {
              const config = (selectedNode.data.config as Record<string, unknown> | undefined) ?? {};
              return <>
                <label><span>左值字段</span><input aria-invalid={Boolean(fieldError('left'))} value={String(config.left ?? '')} placeholder="例如：准备（1）.status" onChange={(event) => updateSelectedConfig({left: event.target.value})} />{fieldError('left') && <small className="workflow-field-error" role="alert">{fieldError('left')}</small>}</label>
                <label><span>运算符</span><select value={String(config.operator ?? 'equals')} onChange={(event) => updateSelectedConfig({operator: event.target.value})}><option value="equals">等于</option><option value="not_equals">不等于</option><option value="contains">包含</option><option value="not_contains">不包含</option><option value="greater_than">大于</option><option value="less_than">小于</option><option value="regex_match">正则匹配</option></select></label>
                <label><span>右值</span><input aria-invalid={Boolean(fieldError('right'))} value={String(config.right ?? '')} placeholder="比较值" onChange={(event) => updateSelectedConfig({right: event.target.value})} />{fieldError('right') && <small className="workflow-field-error" role="alert">{fieldError('right')}</small>}</label>
                <label><span>满足时转到</span><select aria-invalid={Boolean(fieldError('true_next'))} value={String(config.true_next ?? '')} onChange={(event) => updateConditionBranch('true', event.target.value)}><option value="">请选择节点</option>{nodes.filter((node) => node.id !== selectedNode.id).map((node) => <option key={node.id} value={node.id}>{node.data.label as string}</option>)}</select>{fieldError('true_next') && <small className="workflow-field-error" role="alert">{fieldError('true_next')}</small>}</label>
                <label><span>不满足时转到</span><select aria-invalid={Boolean(fieldError('false_next'))} value={String(config.false_next ?? '')} onChange={(event) => updateConditionBranch('false', event.target.value)}><option value="">请选择节点</option>{nodes.filter((node) => node.id !== selectedNode.id).map((node) => <option key={node.id} value={node.id}>{node.data.label as string}</option>)}</select>{fieldError('false_next') && <small className="workflow-field-error" role="alert">{fieldError('false_next')}</small>}</label>
              </>;
            })()}
            {(selectedNode.type === 'prepare' || selectedNode.type === 'finalize') && (
              <label className="workflow-property-wide"><span>节点说明</span><textarea rows={3} value={String((selectedNode.data.config as Record<string, unknown> | undefined)?.description ?? '')} placeholder="说明该节点在流程中的作用" onChange={(event) => updateSelectedConfig({description: event.target.value})} /></label>
            )}
          </div>
        )}
      </section>

      {/* 节点信息 */}
      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
          {language === 'zh' ? '当前工作流' : 'Current Workflow'}
        </h3>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          {language === 'zh' ? '节点数:' : 'Nodes:'} <strong>{nodes.length}</strong> ·
          {language === 'zh' ? '连线数:' : 'Edges:'} <strong>{edges.length}</strong>
        </div>
      </div>
    </div>
  );
}
