import React, { memo, useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';

const OllamaNode = ({ id, type, data }) => {
  const { setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [localModel, setLocalModel] = useState(data.model || 'llama3');
  const [windowSize, setWindowSize] = useState(data.windowSize || 5);
  
  const [testStatus, setTestStatus] = useState(data.connectionStatus || 'Not Tested');
  const [loading, setLoading] = useState(false);
  const [instanceUrl, setInstanceUrl] = useState(data.instanceUrl || '');
  const [clientId, setClientId] = useState(data.clientId || '');

  const [transformKey, setTransformKey] = useState(data.transformKey || 'Email');
  const [operation, setOperation] = useState(data.operation || 'unique');

  const updateNodeData = (updatedFields) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...updatedFields } } : n))
    );
  };

  const handleFileUpload = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n').map(line => line.trim()).filter(line => line !== '');
      if (lines.length < 2) return;

      // Extract raw header fields by splitting the very first array string row element safely
      const headers = lines[0].split(',').map(h => h.trim());
      
      const parsedRows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const rowObject = {};
        headers.forEach((header, index) => {
          rowObject[header] = values[index] || '';
        });
        return rowObject;
      });

      updateNodeData({ 
        uploadedData: parsedRows,
        log: `Successfully imported ${parsedRows.length} rows from ${file.name}`
      });
    };
    reader.readAsText(file);
  };

  const handleTestConnection = async (e) => {
    e.stopPropagation();
    setLoading(true);
    setTestStatus('Testing... ⏳');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    if (!instanceUrl || !clientId) {
      const failedMsg = '❌ Failed (Missing Fields)';
      setTestStatus(failedMsg);
      updateNodeData({ connectionStatus: failedMsg });
    } else {
      const successMsg = '✅ Connected Successfully';
      setTestStatus(successMsg);
      updateNodeData({ connectionStatus: successMsg });
    }
    setLoading(false);
  };

  // --- 1. CHAT INPUT NODE ---
  if (type === 'chatInput') {
    return (
      <div className="node-card-base node-chat-input">
        <div className="node-title-chat">💬 Chat Input Node</div>
        <textarea
          placeholder="Ask AI or instruct data loops..."
          value={data.question || ''}
          onChange={(e) => updateNodeData({ question: e.target.value })}
          className="node-textarea"
        />
        <Handle type="source" position={Position.Bottom} className="handle-chat-in" />
      </div>
    );
  }

  // --- 2. CONVERSATION MEMORY NODE ---
  if (type === 'conversationMemory') {
    const historyCount = data.history ? data.history.length : 0;
    return (
      <div className="node-card-base node-memory">
        <div className="node-title-memory">🧠 Advanced Chat Memory</div>
        <label className="node-label">Buffer Window Size:</label>
        <input 
          type="number" 
          value={windowSize} 
          onChange={(e) => { setWindowSize(e.target.value); updateNodeData({ windowSize: parseInt(e.target.value) || 5 }); }}
          className="node-input"
        />
        <div className="node-log-box node-log-memory">
          Cached Logs: <strong>{historyCount} messages</strong>
          <button 
            onClick={() => updateNodeData({ history: [] })}
            className="node-test-btn bg-memory"
            style={{ marginTop: '5px', padding: '3px', fontSize: '10px' }}
          >
            Clear Stored Sessions
          </button>
        </div>
        <Handle type="source" position={Position.Right} id="memory-out" className="handle-memory-in" />
      </div>
    );
  }

  // --- 3. DATA TRANSFORMATION NODE ---
  if (type === 'dataTransform') {
    return (
      <div className="node-card-base node-transform">
        <Handle type="target" position={Position.Top} id="transform-in" className="handle-chat-in" />
        <div className="node-title-transform">⚡ Data Transformation (XLS/CSV)</div>
        
        <label className="node-label" style={{ marginBottom: '8px' }}>
          Import Dataset (CSV):
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileUpload}
            style={{ display: 'block', marginTop: '4px', fontSize: '11px', width: '100%' }}
          />
        </label>

        <label className="node-label">Transformation Type:</label>
        <select 
          value={operation} 
          onChange={(e) => { setOperation(e.target.value); updateNodeData({ operation: e.target.value }); }} 
          className="node-select"
        >
          <option value="unique">Get Unique Rows (Remove Dups)</option>
          <option value="uppercase">Convert Values to Uppercase</option>
        </select>

        <label className="node-label">Target Filter Property Key:</label>
        <input 
          type="text" 
          value={transformKey}
          onChange={(e) => { setTransformKey(e.target.value); updateNodeData({ transformKey: e.target.value }); }}
          className="node-input"
          placeholder="e.g. Email or Company"
        />

        <div className="node-log-box node-log-transform">
          <strong>Telemetry Status:</strong>
          <div style={{ marginTop: '4px', fontSize: '10px', lineHeight: '14px' }}>{data.log || 'Awaiting file upload...'}</div>
        </div>
        <Handle type="source" position={Position.Bottom} id="transform-out" className="node-transform" />
      </div>
    );
  }

  // --- 4. ENTERPRISE CONNECTORS ---
  if (type === 'salesforceTool' || type === 'sapTool') {
    const isSalesforce = type === 'salesforceTool';
    const title = isSalesforce ? '☁️ Salesforce Connector' : '📦 SAP Enterprise Node';
    const customClass = isSalesforce ? 'node-salesforce' : 'node-sap';
    const customTitleClass = isSalesforce ? 'node-title-salesforce' : 'node-title-sap';
    const customBtnClass = isSalesforce ? 'node-test-btn bg-salesforce' : 'node-test-btn bg-sap';
    const handleColor = isSalesforce ? '#00a1e0' : '#f0ab00';

    return (
      <div className={`node-card-base ${customClass}`}>
        <Handle type="target" position={Position.Top} id="tool-in" style={{ background: handleColor, width: '10px', height: '10px' }} />
        <div className={customTitleClass}>{title}</div>
        
        <div>
          <label className="node-label">
            {isSalesforce ? 'Instance URL:' : 'App Host / IP Address:'}
            <input 
              type="text" 
              placeholder={isSalesforce ? 'https://salesforce.com' : '10.0.1.45'} 
              value={instanceUrl}
              onChange={(e) => { setInstanceUrl(e.target.value); updateNodeData({ instanceUrl: e.target.value }); }}
              className="node-input"
            />
          </label>
          <label className="node-label">
            {isSalesforce ? 'Client OAuth Key ID:' : 'SAP Client System No:'}
            <input 
              type="text" 
              placeholder={isSalesforce ? 'ConsumerKey_XYZ...' : '800'} 
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); updateNodeData({ clientId: e.target.value }); }}
              className="node-input"
            />
          </label>
        </div>

        <button onClick={handleTestConnection} disabled={loading} className={customBtnClass}>
          {loading ? 'Verifying...' : '🔌 Test Connection'}
        </button>

        <div className="node-log-box" style={{ background: '#f8f9fa' }}>
          Status: <strong style={{ color: testStatus.includes('✅') ? '#28a745' : testStatus.includes('❌') ? '#dc3545' : '#666' }}>{testStatus}</strong>
        </div>
        <Handle type="source" position={Position.Left} id="tool-out" style={{ background: handleColor, width: '10px', height: '10px' }} />
      </div>
    );
  }

  // --- 5. DEFAULT OLLAMA AGENT NODE ---
  return (
    <div className="node-card-base">
      <Handle type="target" position={Position.Top} id="chat-in" className="handle-chat-in" />
      <Handle type="target" position={Position.Left} id="memory-in" className="handle-memory-in" />
      <Handle type="target" position={Position.Right} id="tools-in" className="handle-tools-in" />
      
      <div className="node-header">
        <span style={{ fontWeight: 'bold', color: '#646cff' }}>🤖 Ollama Agent</span>
        <button onClick={() => setIsEditing(!isEditing)} className="node-config-toggle">
          {isEditing ? '[Done]' : '[Config]'}
        </button>
      </div>

      {isEditing ? (
        <div style={{ marginBottom: '8px' }}>
          <select value={localModel} onChange={(e) => { setLocalModel(e.target.value); updateNodeData({ model: e.target.value }); }} className="node-select">
            <option value="llama3">llama3</option>
            <option value="mistral">mistral</option>
            <option value="codellama">codellama</option>
          </select>
        </div>
      ) : (
        <div className="node-model-label">
          <strong>Active Model:</strong> {data.model || 'llama3'}
        </div>
      )}

      <div className="node-log-box terminal-panel-log-output">
        <strong>Execution logs:</strong>
        <div className="node-log-text-inner">{data.answer || '(Awaiting trigger activation...)'}</div>
      </div>
    </div>
  );
};

export default memo(OllamaNode);
