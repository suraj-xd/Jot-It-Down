import { Node, mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer, NodeViewWrapper, ReactNodeViewProps } from "@tiptap/react"
import { DigitalTimer, parseTimerInput } from "@/components/todos/digital-timer"
import { StickyNote, parseStickyNoteInput } from "@/components/todos/sticky-note"

const TimerNodeView = ({ 
  node, 
  deleteNode 
}: ReactNodeViewProps) => {
  return (
    <NodeViewWrapper>
      <DigitalTimer 
        initialSeconds={node.attrs.seconds as number} 
        label={node.attrs.label as string} 
        onDelete={deleteNode}
      />
    </NodeViewWrapper>
  )
}

export const TimerNode = Node.create({
  name: "timerNode",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      seconds: { default: 300 },
      label: { default: "5 mins" },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="timer"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "timer" })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(TimerNodeView)
  },
})

const StickyNoteNodeView = ({
  node,
  updateAttributes,
  deleteNode,
}: ReactNodeViewProps) => {
  return (
    <NodeViewWrapper>
      <StickyNote
        content={node.attrs.content as string}
        color={node.attrs.color as "yellow" | "pink" | "blue" | "green" | "purple"}
        title={node.attrs.title as string}
        onChange={(content) => updateAttributes({ content })}
        onDelete={deleteNode}
      />
    </NodeViewWrapper>
  )
}

export const StickyNoteNode = Node.create({
  name: "stickyNoteNode",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      content: { default: "" },
      color: { default: "yellow" },
      title: { default: "" },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="sticky-note"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "sticky-note" })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(StickyNoteNodeView)
  },
})

export { parseTimerInput, parseStickyNoteInput }
