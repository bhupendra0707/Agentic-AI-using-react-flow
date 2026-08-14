import React, { useCallback, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from '@xyflow/react';

import OllamaNode from './OllamaNode';

const nodeTypes = {
  chatInput: OllamaNode,
  ollamaModel: OllamaNode,
  conversationMemory: OllamaNode,
  salesforceTool: OllamaNode,
  sapTool: OllamaNode,
  dataTransform: OllamaNode,
};

const initialNodes = [
  { id: 'chat-1', type: 'chatInput', position: { x: 250, y: 10 }, data: { question: 'Analyze this clean data and summarize findings' } },
  { id: 'transform-1', type: 'dataTransform', position: { x: 250, y: 150 }, data: { transformKey: 'Email', operation: 'unique', log: 'Awaiting CSV file...' } },
  { id: 'agent-core', type: 'ollamaModel', position: { x: 250, y: 380 }, data: { model: 'llama3', answer: '' } },
];

const initialEdges = [
  { id: 'e1', source: 'chat-1', target: 'transform-1', targetHandle: 'transform-in', animated: true },
  { id: 'e2', source: 'transform-1', sourceHandle: 'transform-out', target: 'agent-core', targetHandle: 'chat-in', animated: true },
];

async function callOllama(modelName, prompt) {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, prompt: prompt, stream: false })
    });
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error(error);
    return 'Ollama backend offline. Ensure local serve engine is active via terminal command: ollama serve';
  }
}

export default function WorkflowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState(null);
  const [statusText, setStatusText] = useState('System Standby');

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((event, node) => setSelectedNode(node), []);
  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  const addPaletteNode = (nodeType) => {
    const id = `${nodeType}-${Date.now()}`;
    const newNode = { 
      id, 
      type: nodeType, 
      position: { x: 100, y: 100 }, 
      data: { model: 'llama3', history: [], windowSize: 5, instanceUrl: '', clientId: '', transformKey: 'Email', operation: 'unique', connectionStatus: 'Not Tested', answer: '', log: 'Ready' } 
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const deleteNode = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  };

  const handleExportWorkflow = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ nodes, edges }, null, 2))}`;
    const anchor = document.createElement('a');
    anchor.setAttribute('href', jsonString);
    anchor.setAttribute('download', `agentic-flow-config-${Date.now()}.json`);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const triggerPipeline = async () => {
    setStatusText('Reading canvas nodes data structure...');
    
    const agentNode = nodes.find(n => n.type === 'ollamaModel');
    const transformNode = nodes.find(n => n.type === 'dataTransform');
    
    if (!agentNode) {
      setStatusText('Error: Missing Agent Node');
      return;
    }

    let rawDataset = (transformNode && transformNode.data.uploadedData) ? transformNode.data.uploadedData : [];
    let transformLogText = '';

    if (rawDataset.length === 0) {
      transformLogText = '⚠️ Warn: Running workflow with empty dataset. Upload a CSV file first.';
    } else if (transformNode) {
      const filterPropertyKey = transformNode.data.transformKey || 'Email';
      const operationType = transformNode.data.operation || 'unique';

      if (operationType === 'unique') {
        const uniqueTrackerMap = new Set();
        const outputUniqueRows = [];

        rawDataset.forEach(row => {
          const matchingValue = row[filterPropertyKey];
          if (matchingValue && !uniqueTrackerMap.has(matchingValue)) {
            uniqueTrackerMap.add(matchingValue);
            outputUniqueRows.push(row);
          }
        });

        const filteredCount = rawDataset.length - outputUniqueRows.length;
        transformLogText = `✅ Deduplicated: Filtered out ${filteredCount} duplicates. Processing ${outputUniqueRows.length} unique records.`;
        rawDataset = outputUniqueRows;
      } else if (operationType === 'uppercase') {
        rawDataset = rawDataset.map(row => {
          const updatedRow = { ...row };
          if (updatedRow[filterPropertyKey]) {
            updatedRow[filterPropertyKey] = String(updatedRow[filterPropertyKey]).toUpperCase();
          }
          return updatedRow;
        });
        transformLogText = `✅ Formatted: Converted values in [${filterPropertyKey}] to uppercase format.`;
      }

      setNodes((prevNodes) =>
        prevNodes.map((n) => (n.id === transformNode.id ? { ...n, data: { ...n.data, log: transformLogText } } : n))
      );
    }

    const promptNode = nodes.find(n => n.type === 'chatInput');
    const baseQuestion = promptNode ? promptNode.data.question : 'Process records';

    const cleanDatasetString = rawDataset.length > 0 
      ? rawDataset.map((r, i) => `${i+1}. ` + Object.entries(r).map(([k,v]) => `${k}: ${v}`).join(' | ')).join('\n')
      : 'Empty sheet dataset.';

    const compiledSystemInstructions = `
Spreadsheet analytics environment online.
[TRANSFORMATION LOG]: ${transformLogText}
[PROCESSED DATASET ROWS]:
${cleanDatasetString}
[USER PROMPT TASK EXECUTABLE]: ${baseQuestion}
`;

    setStatusText('Computing agent analysis...');
    const modelTarget = agentNode.data.model || 'llama3';
    const finalResponseText = await callOllama(modelTarget, compiledSystemInstructions);

    setNodes((prevNodes) =>
      prevNodes.map((n) => (n.id === agentNode.id ? { ...n, data: { ...n.data, answer: finalResponseText } } : n))
    );

    setStatusText('Completed Successfully');
  };

  return (
    <div className="flow-container">
      <div className="top-bar">
        <div className="top-bar-title">Agentic Transform Canvas Hub</div>
        <div className="top-bar-actions">
          <span className="status-badge">
            Status: <strong>{statusText}</strong>
          </span>
          <button onClick={handleExportWorkflow} className="export-btn">
            Export Layout JSON
          </button>
          <button onClick={triggerPipeline} className="run-btn">
            Run Prompt Graph
          </button>
        </div>
      </div>

      <div className="main-layout">
        <div className="canvas-panel">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
          >
            <Controls />
            <MiniMap />
            <Background variant="dots" gap={12} size={1} />
          </ReactFlow>
        </div>

        <div className="sidebar-panel">
          <div>
            <h3 className="panel-title">Full Node Palette</h3>
            <button onClick={() => addPaletteNode('chatInput')} style={{ background: '#28a745' }} className="palette-btn">Add Chat Input Node</button>
            <button onClick={() => addPaletteNode('ollamaModel')} style={{ background: '#646cff' }} className="palette-btn">Add Ollama Agent Node</button>
            <button onClick={() => addPaletteNode('dataTransform')} style={{ background: '#9c27b0' }} className="palette-btn">Add Data Transform Node</button>
            <button onClick={() => addPaletteNode('conversationMemory')} style={{ background: '#ff6b6b' }} className="palette-btn">Add Memory Buffer</button>
            <button onClick={() => addPaletteNode('salesforceTool')} style={{ background: '#00a1e0' }} className="palette-btn">Add Salesforce Node</button>
            <button onClick={() => addPaletteNode('sapTool')} style={{ background: '#f0ab00' }} className="palette-btn">Add SAP Business Node</button>
          </div>

          <div>
            <h3 className="panel-title">Node Selection Control</h3>
            {selectedNode ? (
              <div className="inspector-card">
                <div className="inspector-item"><strong>ID:</strong> {selectedNode.id}</div>
                <div className="inspector-item"><strong>Type:</strong> {selectedNode.type}</div>
                <button onClick={deleteNode} className="delete-btn">Delete Selection</button>
              </div>
            ) : (
              <div className="placeholder-text">
                Select a canvas block object to run system adjustments or clear elements.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
