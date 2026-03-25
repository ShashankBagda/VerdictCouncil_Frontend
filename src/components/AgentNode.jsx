function AgentNode({ data }) {
  const statusClass = data.status ? data.status : 'idle'
  const redoClass = data.isRedoTarget ? 'redo' : ''

  return (
    <div className={`agent-node ${statusClass} ${redoClass}`.trim()}>
      <span className="node-layer">{data.layer}</span>
      <div className="node-label">{data.title}</div>
      <div className="file-meta">
        <span>Stage {data.index}</span>
        <span>{data.statusLabel}</span>
      </div>
    </div>
  )
}

export default AgentNode
