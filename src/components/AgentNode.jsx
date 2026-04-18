function AgentNode({ data }) {
  const statusClass = data.status ? data.status : 'idle'
  const redoClass = data.isRedoTarget ? 'redo' : ''
  const selectedClass = data.isSelected ? 'selected' : ''

  return (
    <div className={`agent-node ${statusClass} ${redoClass} ${selectedClass}`.trim()}>
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
