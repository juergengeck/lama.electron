/**
 * Message Flow Tracer
 * Tracks message flow between browser and Node.js instances
 */

class MessageFlowTracer {
  constructor() {
    this.traces = new Map()
    this.enabled = true
  }
  
  tracePoint(messageId, point, details = {}) {
    if (!this.enabled) return
    
    const timestamp = new Date().toISOString()
    const traceEntry = {
      point,
      timestamp,
      details,
      deltaMs: 0
    }
    
    if (!this.traces.has(messageId)) {
      this.traces.set(messageId, [])
    }
    
    const trace = this.traces.get(messageId)
    if (trace.length > 0) {
      const lastTime = new Date(trace[trace.length - 1].timestamp)
      const currentTime = new Date(timestamp)
      traceEntry.deltaMs = currentTime - lastTime
    }
    
    trace.push(traceEntry)
    
    // Log with color coding
    const color = this.getColorForPoint(point)
    console.log(
      `${color}[TRACE][${messageId.substring(0, 8)}] ${point}`,
      details,
      trace.length > 1 ? `(+${traceEntry.deltaMs}ms)` : ''
    )
  }
  
  getColorForPoint(point) {
    const colors = {
      'BROWSER_SEND_START': '\x1b[36m',        // Cyan
      'BROWSER_TOPIC_ROOM': '\x1b[36m',        // Cyan
      'BROWSER_CHANNEL_CREATE': '\x1b[36m',    // Cyan
      'BROWSER_ACCESS_GRANT': '\x1b[32m',      // Green
      'BROWSER_MESSAGE_STORED': '\x1b[36m',    // Cyan
      'CHUM_SYNC_START': '\x1b[33m',          // Yellow
      'CHUM_CHANNEL_UPDATE': '\x1b[33m',      // Yellow
      'NODE_CHANNEL_RECEIVED': '\x1b[35m',    // Magenta
      'NODE_MESSAGE_READ': '\x1b[35m',        // Magenta
      'NODE_AI_PROCESS': '\x1b[34m',          // Blue
      'NODE_RESPONSE_SEND': '\x1b[35m',       // Magenta
      'NODE_ACCESS_GRANT': '\x1b[32m',        // Green
      'BROWSER_RESPONSE_RECEIVED': '\x1b[36m' // Cyan
    }
    return colors[point] || '\x1b[0m'
  }
  
  getFullTrace(messageId) {
    if (!this.traces.has(messageId)) {
      return null
    }
    
    const trace = this.traces.get(messageId)
    let totalTime = 0
    
    if (trace.length > 1) {
      const firstTime = new Date(trace[0].timestamp)
      const lastTime = new Date(trace[trace.length - 1].timestamp)
      totalTime = lastTime - firstTime
    }
    
    return {
      messageId,
      points: trace,
      totalTimeMs: totalTime,
      summary: this.generateSummary(trace)
    }
  }
  
  generateSummary(trace) {
    const steps = trace.map(t => t.point).join(' → ')
    return steps
  }
  
  logFullTrace(messageId) {
    const fullTrace = this.getFullTrace(messageId)
    if (!fullTrace) {
      console.log(`[TRACE] No trace found for message ${messageId}`)
      return
    }
    
    console.log('\n' + '='.repeat(80))
    console.log(`MESSAGE FLOW TRACE: ${messageId}`)
    console.log('='.repeat(80))
    console.log(`Total Time: ${fullTrace.totalTimeMs}ms`)
    console.log(`Flow: ${fullTrace.summary}`)
    console.log('-'.repeat(80))
    
    fullTrace.points.forEach((point, idx) => {
      const prefix = idx === 0 ? '┌─' : idx === fullTrace.points.length - 1 ? '└─' : '├─'
      console.log(`${prefix} [${point.timestamp}] ${point.point}`)
      if (point.deltaMs > 0) {
        console.log(`│  +${point.deltaMs}ms`)
      }
      if (Object.keys(point.details).length > 0) {
        console.log(`│  Details:`, point.details)
      }
    })
    
    console.log('='.repeat(80) + '\n')
  }
}

// Create singleton instance
const messageFlowTracer = new MessageFlowTracer()

export default messageFlowTracer