import React, { useMemo, useState, useEffect } from "react";
import { 
  ReactFlow, 
  Background, 
  BackgroundVariant,
  Controls, 
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
  Panel,
  Handle,
  Position,
  PanOnScrollMode,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { Play, CheckCircle, Trophy, Hammer, Flag, X, Download, RotateCcw } from "lucide-react";

// --- CUSTOM NODES ---

const StartNode = ({ data }: any) => (
  <div className="flex items-center justify-center w-20 h-20 bg-[#10B981]/20 rounded-full border-2 border-[#10B981] shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse">
    <div className="text-center">
      <div className="text-2xl">🚀</div>
      <div className="text-[10px] font-bold text-[#10B981] uppercase tracking-wider mt-1">Start</div>
    </div>
    <Handle type="source" position={Position.Bottom} className="opacity-0" />
  </div>
);

const ModuleNode = ({ data }: any) => (
  <div className="w-[220px] bg-[#1A172E] border border-[#2A2443] rounded-xl overflow-hidden shadow-lg">
    <Handle type="target" position={Position.Top} className="opacity-0" />
    <div className="bg-[#6366F1] px-4 py-2 flex items-center justify-between">
      <span className="text-xs font-bold text-white uppercase tracking-wider">Module {data.order}</span>
      <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{data.lessonCount || 0} Lessons</span>
    </div>
    <div className="p-4">
      <h3 className="font-bold text-white text-sm">{data.label}</h3>
    </div>
    <Handle type="source" position={Position.Bottom} className="opacity-0" />
  </div>
);

const LessonNode = ({ data }: any) => {
  const isCompleted = data.isCompleted;
  return (
    <div className={`w-[180px] bg-[#111118] border-2 ${isCompleted ? 'border-[#10B981]' : data.isActive ? 'border-[#6366F1]' : 'border-[#2A2443]'} rounded-xl p-4 shadow-xl transition-all cursor-pointer hover:border-[#6366F1]`}>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div className="flex justify-between items-start mb-2">
        <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${data.difficulty === 'Beginner' ? 'bg-emerald-500/10 text-emerald-400' : data.difficulty === 'Intermediate' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'}`}>
          {data.difficulty || 'Beginner'}
        </span>
        {isCompleted && <CheckCircle className="w-4 h-4 text-[#10B981]" />}
      </div>
      <h4 className="font-bold text-[#FAF9FD] text-sm mb-1 leading-tight">{data.label}</h4>
      <div className="text-xs text-[#8E88AB]">{data.duration || '30 mins'}</div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
};

const MilestoneNode = ({ data }: any) => (
  <div className="w-[160px] h-[160px] flex items-center justify-center relative">
    <Handle type="target" position={Position.Top} className="opacity-0" />
    <div className="absolute inset-0 bg-[#F59E0B]/10 border-2 border-[#F59E0B] rotate-45 rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.2)]"></div>
    <div className="relative z-10 text-center p-4">
      <Trophy className="w-8 h-8 text-[#F59E0B] mx-auto mb-2" />
      <div className="text-xs font-bold text-[#F59E0B] uppercase tracking-wider mb-1">Milestone</div>
      <h4 className="font-bold text-white text-xs leading-tight">{data.label}</h4>
    </div>
    <Handle type="source" position={Position.Bottom} className="opacity-0" />
  </div>
);

const ProjectNode = ({ data }: any) => (
  <div className="w-[200px] bg-[#111118] border-2 border-[#F97316] rounded-xl overflow-hidden shadow-[0_0_20px_rgba(249,115,22,0.15)]">
    <Handle type="target" position={Position.Top} className="opacity-0" />
    <div className="bg-[#F97316]/10 px-4 py-2 border-b border-[#F97316]/20 flex items-center gap-2">
      <Hammer className="w-4 h-4 text-[#F97316]" />
      <span className="text-xs font-bold text-[#F97316] uppercase tracking-wider">Project</span>
    </div>
    <div className="p-4">
      <h4 className="font-bold text-white text-sm mb-1">{data.label}</h4>
      <p className="text-xs text-[#8E88AB] line-clamp-2">{data.description}</p>
    </div>
    <Handle type="source" position={Position.Bottom} className="opacity-0" />
  </div>
);

const EndNode = ({ data }: any) => (
  <div className="flex items-center justify-center w-24 h-24 bg-[#EAB308]/20 rounded-full border-4 border-[#EAB308] shadow-[0_0_40px_rgba(234,179,8,0.4)] relative">
    <Handle type="target" position={Position.Top} className="opacity-0" />
    <div className="text-center relative z-10">
      <div className="text-3xl mb-1">🏆</div>
      <div className="text-[10px] font-bold text-[#EAB308] uppercase tracking-wider">Complete!</div>
    </div>
  </div>
);

const nodeTypes = {
  start: StartNode,
  module: ModuleNode,
  lesson: LessonNode,
  milestone: MilestoneNode,
  project: ProjectNode,
  end: EndNode,
};

// --- LAYOUT LOGIC ---
const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Create a new layout instance
  const nodeWidth = 220;
  const nodeHeight = 180;

  dagreGraph.setGraph({ 
    rankdir: direction, 
    ranksep: 100, 
    nodesep: 60,
    edgesep: 40,
    align: 'DL'
  });

  nodes.forEach((node) => {
    // Make start/end nodes smaller in layout logic
    const width = node.type === 'start' || node.type === 'end' ? 100 : nodeWidth;
    const height = node.type === 'start' || node.type === 'end' ? 100 : nodeHeight;
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const width = node.type === 'start' || node.type === 'end' ? 100 : nodeWidth;
    const height = node.type === 'start' || node.type === 'end' ? 100 : nodeHeight;
    
    // We are shifting the dagre node position (anchor=center center) to the top left
    // so it matches the React Flow node anchor point (top left).
    return {
      ...node,
      targetPosition: direction === 'LR' ? Position.Left : Position.Top,
      sourcePosition: direction === 'LR' ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
};

export interface VisualRoadmapGraphProps {
  roadmapData: any;
  completedNodeIds: string[];
  onToggleComplete: (nodeId: string) => Promise<void>;
  onClose?: () => void;
}

function VisualRoadmapGraphInner({
  roadmapData,
  completedNodeIds,
  onToggleComplete,
  onClose,
}: VisualRoadmapGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const { fitView, setCenter, getZoom } = useReactFlow();

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    if (!roadmapData || !roadmapData.nodes || !roadmapData.edges) return;

    // Build flow nodes
    const initialNodes = roadmapData.nodes.map((n: any) => ({
      id: n.id,
      type: n.type,
      data: {
        ...n,
        isCompleted: completedNodeIds.includes(n.id),
      },
      position: { x: 0, y: 0 }, // Handled by dagre
    }));

    // Build flow edges
    const initialEdges = roadmapData.edges.map((e: any) => {
      let stroke = '#4B5563'; // Optional / default
      let strokeDasharray = '5,5'; // Dashed
      let animated = false;

      if (e.type === 'required' || e.type === 'parallel') {
        stroke = '#6366F1'; // Indigo
        strokeDasharray = '0'; // Solid
      }

      // Check if source node is completed
      if (completedNodeIds.includes(e.source)) {
        stroke = '#10B981'; // Emerald
      }

      // Check if it's the currently active path (source completed, target not)
      if (completedNodeIds.includes(e.source) && !completedNodeIds.includes(e.target)) {
        animated = true;
      }

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        animated,
        style: { stroke, strokeWidth: 2, strokeDasharray },
        label: e.label,
        labelStyle: { fill: '#8E88AB', fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: '#1A172E', fillOpacity: 0.8 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 15,
          height: 15,
          color: stroke,
        },
      };
    });

    const isMobile = window.innerWidth < 768;
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      initialNodes,
      initialEdges,
      isMobile ? 'TB' : 'LR'
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [roadmapData, completedNodeIds]);

  const onNodeClick = (event: React.MouseEvent, node: any) => {
    setActiveNodeId(node.id);
    if (['lesson', 'project', 'milestone'].includes(node.type)) {
      setSelectedNodeId(node.id);
    }
  };

  const selectedNode = selectedNodeId ? roadmapData.nodes.find((n: any) => n.id === selectedNodeId) : null;
  const isCompleted = selectedNode ? completedNodeIds.includes(selectedNode.id) : false;

  const handleToggle = async () => {
    if (selectedNode) {
      await onToggleComplete(selectedNode.id);
    }
  };

  return (
    <div style={{ width: '100%', height: 'min(700px, 75vh)' }} className="relative bg-[#0F0D19] rounded-xl overflow-hidden border border-[#1E1E2E]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={1.5}
        className="bg-[#0F0D19]"
        panOnScroll={true}
        panOnScrollMode={PanOnScrollMode.Free}
        zoomOnScroll={false}
        zoomOnPinch={true}
        zoomOnDoubleClick={true}
        panOnDrag={true}
        preventScrolling={true}
        selectionOnDrag={false}
        proOptions={{ hideAttribution: true }}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        attributionPosition="bottom-left"
        nodesDraggable={!isTouchDevice}
        nodesConnectable={false}
        elementsSelectable={true}
      >
        <Background color="#2A2443" gap={20} variant={BackgroundVariant.Dots} />
        <Controls 
          className="react-flow__controls" 
          showZoom={true}
          showFitView={true}
          showInteractive={true}
          fitViewOptions={{ padding: 0.2, duration: 400 }}
        />
        <MiniMap 
          className="react-flow__minimap cursor-pointer" 
          nodeColor={(n) => {
            if (n.type === 'start') return '#10B981';
            if (n.type === 'end') return '#EAB308';
            if (n.type === 'project') return '#F97316';
            if (n.type === 'milestone') return '#F59E0B';
            if (n.type === 'module') return '#6366F1';
            if (completedNodeIds.includes(n.id)) return '#10B981';
            return '#111118';
          }}
          nodeStrokeColor={(n) => {
            if (n.id === activeNodeId) return '#FAF9FD';
            return 'transparent';
          }}
          nodeStrokeWidth={3}
          maskColor="rgba(15, 13, 25, 0.75)"
          maskStrokeColor="#6366F1"
          maskStrokeWidth={2}
          pannable={true}
          zoomable={true}
          zoomStep={10}
          inversePan={false}
          style={{
            width: isTouchDevice ? 100 : 220,
            height: isTouchDevice ? 70 : 150,
          }}
          onClick={(event, position) => {
            // Pan the main canvas to wherever the user clicked on the minimap
            setCenter(position.x, position.y, { zoom: getZoom(), duration: 400 });
          }}
          onNodeClick={(event, node) => {
            // Clicking a node thumbnail inside the minimap jumps straight to it
            event.stopPropagation();
            const flowNode = nodes.find((n) => n.id === node.id);
            if (flowNode) {
              setCenter(
                flowNode.position.x + (flowNode.width || 180) / 2,
                flowNode.position.y + (flowNode.height || 80) / 2,
                { zoom: 1, duration: 500 }
              );
              onNodeClick(event as any, flowNode);
            }
          }}
        />
        
        <Panel position="top-left" className="bg-[#1A172E]/90 backdrop-blur border border-[#2A2443] p-4 rounded-xl shadow-2xl m-4">
          <h2 className="text-xl font-bold text-white mb-1">{roadmapData?.title || "Visual Roadmap"}</h2>
          <div className="flex items-center gap-4 text-xs font-medium text-[#8E88AB]">
            <span>{roadmapData?.nodes?.length || 0} Nodes</span>
            <span>{completedNodeIds.length} Completed</span>
            <span>{roadmapData?.totalDuration || "Est. 4 weeks"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fitView({ padding: 0.2, duration: 400 })}
              className="mt-3 text-xs bg-[#2A2443] hover:bg-[#3F395B] text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset View
            </button>
            {onClose && (
              <button 
                onClick={onClose}
                className="mt-3 text-xs bg-[#2A2443] hover:bg-[#3F395B] text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Back to Roadmaps
              </button>
            )}
          </div>
        </Panel>

        {!isTouchDevice && (
          <Panel position="bottom-right" className="mb-2 mr-2">
            <div className="text-[10px] text-[#8E88AB] bg-[#1A172E]/80 backdrop-blur px-2 py-1 rounded-md border border-[#2A2443]">
              💡 Click the map to jump around
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Detail Panel */}
      <div 
        className={`absolute top-0 right-0 h-full w-[320px] bg-[#111118]/95 backdrop-blur-xl border-l border-[#2A2443] shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${selectedNodeId ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {selectedNode && (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-[#2A2443] flex justify-between items-center">
              <span className="text-xs font-bold text-[#8E88AB] uppercase tracking-wider">{selectedNode.type} Details</span>
              <button onClick={() => setSelectedNodeId(null)} className="p-1 hover:bg-[#2A2443] rounded-lg transition-colors text-[#8E88AB] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              <h3 className="text-xl font-bold text-white mb-2">{selectedNode.label}</h3>
              
              <div className="flex gap-2 mb-6">
                {selectedNode.duration && (
                  <span className="bg-[#1A172E] text-[#8E88AB] px-2.5 py-1 rounded-md text-xs font-medium">
                    ⏱️ {selectedNode.duration}
                  </span>
                )}
                {selectedNode.difficulty && (
                  <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${selectedNode.difficulty === 'Beginner' ? 'bg-emerald-500/10 text-emerald-400' : selectedNode.difficulty === 'Intermediate' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    {selectedNode.difficulty}
                  </span>
                )}
              </div>

              <div className="prose prose-invert prose-sm mb-6">
                <p className="text-[#8E88AB] leading-relaxed">{selectedNode.description}</p>
              </div>

              {selectedNode.concepts && selectedNode.concepts.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Key Concepts</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedNode.concepts.map((concept: string, i: number) => (
                      <span key={i} className="bg-[#6366F1]/10 text-[#6366F1] px-2 py-1 rounded border border-[#6366F1]/20 text-xs font-medium">
                        {concept}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedNode.resources && selectedNode.resources.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Resources</h4>
                  <div className="space-y-2">
                    {selectedNode.resources.map((res: any, i: number) => (
                      <a 
                        key={i} 
                        href={res.url || "#"} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg bg-[#1A172E] border border-[#2A2443] hover:border-[#6366F1] transition-colors group"
                      >
                        <span className="text-lg">
                          {res.type === 'video' ? '📹' : res.type === 'article' ? '📄' : res.type === 'doc' ? '📚' : '💻'}
                        </span>
                        <span className="text-sm font-medium text-[#FAF9FD] group-hover:text-[#6366F1] transition-colors">{res.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#2A2443] bg-[#0F0D19]">
              <button
                onClick={handleToggle}
                className={`w-full py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                  isCompleted 
                    ? 'bg-[#1A172E] text-[#10B981] border border-[#10B981]/30 hover:bg-[#10B981]/10' 
                    : 'bg-[#10B981] text-white hover:bg-[#059669] shadow-[0_4px_14px_rgba(16,185,129,0.4)]'
                }`}
              >
                {isCompleted ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Completed — Click to undo
                  </>
                ) : (
                  "Mark as Complete"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VisualRoadmapGraph(props: VisualRoadmapGraphProps) {
  return (
    <ReactFlowProvider>
      <VisualRoadmapGraphInner {...props} />
    </ReactFlowProvider>
  );
}
