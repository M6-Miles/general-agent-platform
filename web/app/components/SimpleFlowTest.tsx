'use client';

import React from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const initialNodes = [
  {
    id: '1',
    type: 'default',
    data: { label: '开始' },
    position: { x: 250, y: 50 },
  },
  {
    id: '2',
    type: 'default',
    data: { label: '结束' },
    position: { x: 250, y: 200 },
  },
];

const initialEdges = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#ff0000', strokeWidth: 5 },
  },
];

export default function SimpleFlowTest() {
  return (
    <div style={{ width: '100%', height: '500px' }}>
      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
