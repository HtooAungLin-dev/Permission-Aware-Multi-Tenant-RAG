import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  FileText,
  Layers,
  Users,
  Building2,
  ArrowRight,
  Filter,
  Sparkles,
  Zap,
  Info,
  KeyRound,
} from 'lucide-react';
import { ClassificationLevel, Document } from '../types/rag';
import { PersonaWithToken, TenantInfo } from '../services/apiClient';

interface DocumentAclGraphProps {
  documents: Document[];
  personas: PersonaWithToken[];
  selectedTenantId: string;
  onEditDocAcl: (doc: Document) => void;
  onRevokeRole: (docId: string, roleToRemove: string) => Promise<void>;
}

interface GraphNode {
  id: string;
  type: 'tenant' | 'document' | 'chunk' | 'role' | 'user';
  label: string;
  tenantId: string;
  classification?: ClassificationLevel;
  docId?: string;
  metadata?: any;
  x: number;
  y: number;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: 'inherits' | 'authorizes' | 'tenant_contains';
  active: boolean;
  tenantId: string;
}

export const DocumentAclGraph: React.FC<DocumentAclGraphProps> = ({
  documents,
  personas,
  selectedTenantId,
  onEditDocAcl,
  onRevokeRole,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [filterClearance, setFilterClearance] = useState<string>('all');
  const [testPersonaId, setTestPersonaId] = useState<string>(personas[0]?.id || 'usr_bob');
  const [revokingRole, setRevokingRole] = useState<string | null>(null);

  // Filter documents based on tenant and clearance
  const visibleDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchTenant = selectedTenantId === 'all' || doc.tenant_id === selectedTenantId;
      const matchClearance =
        filterClearance === 'all' || doc.acl.classification_level === filterClearance;
      return matchTenant && matchClearance;
    });
  }, [documents, selectedTenantId, filterClearance]);

  // Compute graph layout coordinates
  const { nodes, edges, roleNodes, tenantGroups } = useMemo(() => {
    const nodesList: GraphNode[] = [];
    const edgesList: GraphEdge[] = [];
    const rolesSet = new Set<string>();

    // Collect all unique roles present in visible documents
    visibleDocs.forEach((d) => {
      d.acl.allowed_roles.forEach((r) => rolesSet.add(r));
    });
    const rolesArray = Array.from(rolesSet);

    // Group documents by tenant
    const groupedByTenant: Record<string, Document[]> = {};
    visibleDocs.forEach((d) => {
      if (!groupedByTenant[d.tenant_id]) {
        groupedByTenant[d.tenant_id] = [];
      }
      groupedByTenant[d.tenant_id].push(d);
    });

    const tenantIds = Object.keys(groupedByTenant);
    const canvasWidth = 1040;
    
    // Column X positions
    const colTenantX = 70;
    const colDocX = 300;
    const colChunkX = 590;
    const colRoleX = 890;

    let currentDocY = 40;
    const docSpacing = 110;
    const chunkSpacing = 32;

    tenantIds.forEach((tId, tIdx) => {
      const tenantDocs = groupedByTenant[tId];
      const tenantStartY = currentDocY;

      // Create Tenant Node
      const tenantName = tenantDocs[0]?.tenant_name || tId;
      const tenantNodeId = `tenant_${tId}`;

      tenantDocs.forEach((doc, dIdx) => {
        const docNodeId = `doc_${doc.id}`;
        const docY = currentDocY;

        nodesList.push({
          id: docNodeId,
          type: 'document',
          label: doc.title,
          tenantId: doc.tenant_id,
          classification: doc.acl.classification_level,
          docId: doc.id,
          metadata: doc,
          x: colDocX,
          y: docY,
        });

        // Edge Tenant -> Document
        edgesList.push({
          id: `edge_${tenantNodeId}_${docNodeId}`,
          from: tenantNodeId,
          to: docNodeId,
          type: 'tenant_contains',
          active: true,
          tenantId: doc.tenant_id,
        });

        // Generate Chunk Nodes (representing inherited ACL in vector storage)
        const chunkCount = Math.min(doc.chunkCount || 3, 3);
        const chunkStartY = docY - ((chunkCount - 1) * chunkSpacing) / 2;

        for (let c = 0; c < chunkCount; c++) {
          const chunkNodeId = `chunk_${doc.id}_${c}`;
          const chunkY = chunkStartY + c * chunkSpacing;

          nodesList.push({
            id: chunkNodeId,
            type: 'chunk',
            label: `Chunk #${c + 1} (${doc.acl.classification_level})`,
            tenantId: doc.tenant_id,
            classification: doc.acl.classification_level,
            docId: doc.id,
            metadata: {
              chunk_index: c,
              inherited_tenant_id: doc.acl.tenant_id,
              inherited_roles: doc.acl.allowed_roles,
              inherited_users: doc.acl.allowed_users,
              inherited_classification: doc.acl.classification_level,
            },
            x: colChunkX,
            y: chunkY,
          });

          // Edge Document -> Chunk (Strict ACL Inheritance)
          edgesList.push({
            id: `edge_${docNodeId}_${chunkNodeId}`,
            from: docNodeId,
            to: chunkNodeId,
            type: 'inherits',
            active: true,
            tenantId: doc.tenant_id,
          });

          // Edge Chunk -> Roles (Access Authorization)
          doc.acl.allowed_roles.forEach((role) => {
            const roleNodeId = `role_${role}_${doc.tenant_id}`;
            edgesList.push({
              id: `edge_${chunkNodeId}_${roleNodeId}`,
              from: chunkNodeId,
              to: roleNodeId,
              type: 'authorizes',
              active: true,
              tenantId: doc.tenant_id,
            });
          });
        }

        currentDocY += docSpacing;
      });

      const tenantEndY = currentDocY - docSpacing;
      const tenantMidY = (tenantStartY + tenantEndY) / 2;

      nodesList.push({
        id: tenantNodeId,
        type: 'tenant',
        label: tenantName,
        tenantId: tId,
        x: colTenantX,
        y: tenantMidY,
      });

      currentDocY += 30; // Gap between tenant clusters
    });

    // Position Role Nodes on the right
    const totalRoleCount = rolesArray.length;
    const roleStartY = 50;
    const roleSpacing = Math.max(50, Math.min(80, (currentDocY - 100) / (totalRoleCount || 1)));

    rolesArray.forEach((role, idx) => {
      // Find tenants that utilize this role
      const associatedDocs = visibleDocs.filter((d) => d.acl.allowed_roles.includes(role));
      const primaryTenant = associatedDocs[0]?.tenant_id || 'shared';

      nodesList.push({
        id: `role_${role}_${primaryTenant}`,
        type: 'role',
        label: role === '*' ? 'All Tenant Roles (*)' : `role: ${role}`,
        tenantId: primaryTenant,
        metadata: { roleName: role, docCount: associatedDocs.length },
        x: colRoleX,
        y: roleStartY + idx * roleSpacing,
      });
    });

    return {
      nodes: nodesList,
      edges: edgesList,
      roleNodes: rolesArray,
      tenantGroups: tenantIds,
    };
  }, [visibleDocs]);

  // Selected node lookup
  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  // Selected document if a document or chunk node is picked
  const selectedDoc = useMemo(() => {
    if (!selectedNode) return null;
    if (selectedNode.type === 'document') {
      return (selectedNode.metadata as Document) || null;
    }
    if (selectedNode.type === 'chunk' && selectedNode.docId) {
      return documents.find((d) => d.id === selectedNode.docId) || null;
    }
    return null;
  }, [selectedNode, documents]);

  // Evaluation of persona against selected node
  const activeTestPersona = useMemo(() => {
    return personas.find((p) => p.id === testPersonaId) || personas[0] || null;
  }, [personas, testPersonaId]);

  const personaEvaluation = useMemo(() => {
    if (!selectedDoc || !activeTestPersona) return null;

    const tenantMatch = selectedDoc.tenant_id === activeTestPersona.tenant_id;
    const roleMatch =
      selectedDoc.acl.allowed_roles.includes('*') ||
      selectedDoc.acl.allowed_roles.some((r) => activeTestPersona.roles.includes(r));
    const userMatch = selectedDoc.acl.allowed_users.includes(activeTestPersona.id);

    const rankMap: Record<ClassificationLevel, number> = {
      public: 1,
      internal: 2,
      confidential: 3,
      restricted: 4,
    };
    const userRank = rankMap[activeTestPersona.classification_clearance] || 1;
    const docRank = rankMap[selectedDoc.acl.classification_level] || 1;
    const clearanceMatch = userRank >= docRank;

    const canAccess = tenantMatch && clearanceMatch && (roleMatch || userMatch);

    let reason = '';
    if (!tenantMatch) {
      reason = `Blocked by Tenant Boundary: User belongs to ${activeTestPersona.tenant_id}, document belongs to ${selectedDoc.tenant_id}. Pre-filter strictly isolates search candidates.`;
    } else if (!clearanceMatch) {
      reason = `Blocked by Classification Clearance: User has '${activeTestPersona.classification_clearance}' clearance, but document requires '${selectedDoc.acl.classification_level}'.`;
    } else if (!roleMatch && !userMatch) {
      reason = `Blocked by Role Discretionary ACL: User roles [${activeTestPersona.roles.join(', ')}] do not include any required roles [${selectedDoc.acl.allowed_roles.join(', ')}].`;
    } else {
      reason = `Access Granted: Matches tenant isolation, role clearance [${selectedDoc.acl.allowed_roles.join(', ')}], and classification hierarchy.`;
    }

    return {
      canAccess,
      tenantMatch,
      roleMatch: roleMatch || userMatch,
      clearanceMatch,
      reason,
    };
  }, [selectedDoc, activeTestPersona]);

  // Calculate SVG canvas height
  const maxNodeY = Math.max(...nodes.map((n) => n.y), 450);
  const canvasHeight = Math.max(500, maxNodeY + 80);

  // Check if an edge is highlighted
  const isEdgeHighlighted = (edge: GraphEdge) => {
    const focusId = hoveredNodeId || selectedNodeId;
    if (!focusId) return false;
    return edge.from === focusId || edge.to === focusId;
  };

  const isNodeConnected = (nodeId: string) => {
    const focusId = hoveredNodeId || selectedNodeId;
    if (!focusId) return true;
    if (nodeId === focusId) return true;
    return edges.some(
      (e) =>
        (e.from === focusId && e.to === nodeId) ||
        (e.to === focusId && e.from === nodeId)
    );
  };

  return (
    <div className="space-y-4">
      {/* Visual Graph Controls & Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-900">
              Interactive ACL Propagation Graph
            </h3>
            <p className="text-[11px] text-slate-500">
              Live mapping of Tenant Boundaries → Document ACLs → Vector Chunk Payloads → Role Authorizations
            </p>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1">
            <span className="text-[11px] text-slate-500 font-medium pl-1.5">Clearance:</span>
            <select
              value={filterClearance}
              onChange={(e) => setFilterClearance(e.target.value)}
              className="text-xs font-mono py-0.5 px-2 bg-transparent text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">All Levels</option>
              <option value="public">Public</option>
              <option value="internal">Internal</option>
              <option value="confidential">Confidential</option>
              <option value="restricted">Restricted</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1">
            <span className="text-[11px] text-slate-500 font-medium pl-1.5">Test Persona:</span>
            <select
              value={testPersonaId}
              onChange={(e) => setTestPersonaId(e.target.value)}
              className="text-xs font-mono py-0.5 px-2 bg-transparent text-slate-800 focus:outline-none cursor-pointer"
            >
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.tenant_name.split(' ')[0]} - {p.roles.join(', ')})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Graph Viewport & Inspector Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* SVG Graph Viewport (8 Columns on desktop) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
          {/* Legend Strip */}
          <div className="py-2.5 px-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-slate-600 font-mono gap-2">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-900" />
                <span>Tenant Boundary</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-blue-500" />
                <span>Document ACL</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span>Vector Chunk (Inherited)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
                <span>Target Role</span>
              </span>
            </div>
            <div className="text-slate-400">Click any node to inspect payload propagation</div>
          </div>

          {/* SVG Canvas Container */}
          <div className="overflow-x-auto overflow-y-auto p-4 max-h-[640px] bg-slate-900/2">
            <svg
              width="1040"
              height={canvasHeight}
              viewBox={`0 0 1040 ${canvasHeight}`}
              className="select-none font-sans"
            >
              <defs>
                {/* Gradient for links */}
                <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.6" />
                </linearGradient>
                <linearGradient id="activeLinkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.9" />
                </linearGradient>
              </defs>

              {/* Column Guides and Labels */}
              <text x="70" y="24" className="text-[11px] font-mono font-semibold fill-slate-400">
                TENANTS
              </text>
              <text x="300" y="24" className="text-[11px] font-mono font-semibold fill-slate-400">
                DOCUMENTS & ACLs
              </text>
              <text x="590" y="24" className="text-[11px] font-mono font-semibold fill-slate-400">
                INHERITED VECTOR CHUNKS
              </text>
              <text x="890" y="24" className="text-[11px] font-mono font-semibold fill-slate-400">
                AUTHORIZED ROLES
              </text>

              {/* Render Graph Edges */}
              <g className="edges-layer">
                {edges.map((edge) => {
                  const fromNode = nodes.find((n) => n.id === edge.from);
                  const toNode = nodes.find((n) => n.id === edge.to);
                  if (!fromNode || !toNode) return null;

                  const highlighted = isEdgeHighlighted(edge);
                  const isDimmed =
                    (hoveredNodeId || selectedNodeId) && !highlighted;

                  // Smooth horizontal Bezier curve
                  const dx = (toNode.x - fromNode.x) / 2;
                  const pathData = `M ${fromNode.x} ${fromNode.y} C ${fromNode.x + dx} ${fromNode.y}, ${toNode.x - dx} ${toNode.y}, ${toNode.x} ${toNode.y}`;

                  return (
                    <path
                      key={edge.id}
                      d={pathData}
                      fill="none"
                      stroke={highlighted ? '#6366f1' : '#cbd5e1'}
                      strokeWidth={highlighted ? 2.5 : 1.2}
                      strokeDasharray={edge.type === 'inherits' ? '3,3' : undefined}
                      opacity={isDimmed ? 0.15 : highlighted ? 1 : 0.6}
                      className="transition-all duration-200"
                    />
                  );
                })}
              </g>

              {/* Render Graph Nodes */}
              <g className="nodes-layer">
                {nodes.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  const isHovered = hoveredNodeId === node.id;
                  const isDimmed =
                    (hoveredNodeId || selectedNodeId) &&
                    !isNodeConnected(node.id);

                  // Color coding based on type and classification
                  let nodeColor = '#334155'; // default slate
                  let strokeColor = '#64748b';

                  if (node.type === 'tenant') {
                    nodeColor = '#0f172a';
                    strokeColor = '#3b82f6';
                  } else if (node.type === 'document') {
                    if (node.classification === 'restricted') {
                      nodeColor = '#e11d48';
                      strokeColor = '#be123c';
                    } else if (node.classification === 'confidential') {
                      nodeColor = '#d97706';
                      strokeColor = '#b45309';
                    } else if (node.classification === 'internal') {
                      nodeColor = '#2563eb';
                      strokeColor = '#1d4ed8';
                    } else {
                      nodeColor = '#475569';
                      strokeColor = '#334155';
                    }
                  } else if (node.type === 'chunk') {
                    nodeColor = '#6366f1';
                    strokeColor = '#4f46e5';
                  } else if (node.type === 'role') {
                    nodeColor = '#059669';
                    strokeColor = '#047857';
                  }

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={() => setSelectedNodeId(node.id)}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      className="cursor-pointer transition-opacity duration-150"
                      opacity={isDimmed ? 0.25 : 1}
                    >
                      {/* Node Shape */}
                      {node.type === 'tenant' ? (
                        <>
                          <rect
                            x="-60"
                            y="-16"
                            width="120"
                            height="32"
                            rx="6"
                            fill="#0f172a"
                            stroke={isSelected ? '#38bdf8' : '#334155'}
                            strokeWidth={isSelected ? 2.5 : 1}
                          />
                          <text
                            x="0"
                            y="4"
                            textAnchor="middle"
                            className="text-[11px] font-mono font-bold fill-white"
                          >
                            {node.label.length > 14
                              ? node.label.substring(0, 12) + '...'
                              : node.label}
                          </text>
                        </>
                      ) : node.type === 'document' ? (
                        <>
                          <rect
                            x="-110"
                            y="-20"
                            width="220"
                            height="40"
                            rx="6"
                            fill="#ffffff"
                            stroke={isSelected ? '#6366f1' : strokeColor}
                            strokeWidth={isSelected ? 2.5 : 1.5}
                            filter="drop-shadow(0 1px 2px rgba(0,0,0,0.06))"
                          />
                          {/* Classification color strip */}
                          <rect
                            x="-110"
                            y="-20"
                            width="5"
                            height="40"
                            rx="1"
                            fill={nodeColor}
                          />
                          <text
                            x="-95"
                            y="-4"
                            className="text-[11px] font-semibold fill-slate-900"
                          >
                            {node.label.length > 25
                              ? node.label.substring(0, 23) + '...'
                              : node.label}
                          </text>
                          <text
                            x="-95"
                            y="12"
                            className="text-[10px] font-mono fill-slate-500 uppercase"
                          >
                            {node.classification} · {node.tenantId}
                          </text>
                        </>
                      ) : node.type === 'chunk' ? (
                        <>
                          <rect
                            x="-70"
                            y="-12"
                            width="140"
                            height="24"
                            rx="4"
                            fill="#f8fafc"
                            stroke={isSelected ? '#6366f1' : '#cbd5e1'}
                            strokeWidth={isSelected ? 2 : 1}
                          />
                          <circle cx="-58" cy="0" r="3.5" fill="#6366f1" />
                          <text
                            x="-48"
                            y="3.5"
                            className="text-[10px] font-mono fill-slate-700 font-medium"
                          >
                            {node.label}
                          </text>
                        </>
                      ) : (
                        /* Role Node */
                        <>
                          <rect
                            x="-70"
                            y="-14"
                            width="140"
                            height="28"
                            rx="5"
                            fill="#f0fdf4"
                            stroke={isSelected ? '#10b981' : '#86efac'}
                            strokeWidth={isSelected ? 2 : 1}
                          />
                          <text
                            x="0"
                            y="4"
                            textAnchor="middle"
                            className="text-[11px] font-mono font-medium fill-emerald-800"
                          >
                            {node.label}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        </div>

        {/* Node & Propagation Inspector Panel (4 Columns on desktop) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-semibold text-slate-900">
                ACL Propagation Inspector
              </h4>
            </div>
            {selectedNode && (
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">
                {selectedNode.type}
              </span>
            )}
          </div>

          {selectedNode ? (
            <div className="space-y-3.5 text-xs">
              {/* Selected Node Header */}
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">
                  Inspected Node:
                </span>
                <div className="font-semibold text-slate-900 mt-0.5 text-sm">
                  {selectedNode.label}
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                  ID: {selectedNode.id}
                </div>
              </div>

              {/* Propagation Invariants Verification */}
              {selectedDoc && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 font-mono text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Tenant Boundary:</span>
                    <span className="text-indigo-600 font-bold">
                      {selectedDoc.acl.tenant_id}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Classification:</span>
                    <span className="text-slate-900 uppercase font-semibold">
                      {selectedDoc.acl.classification_level}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Allowed Roles:</span>
                    <span className="text-slate-800">
                      [{selectedDoc.acl.allowed_roles.join(', ')}]
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Allowed Users:</span>
                    <span className="text-slate-800">
                      {selectedDoc.acl.allowed_users.length > 0
                        ? `[${selectedDoc.acl.allowed_users.join(', ')}]`
                        : 'Any role holder'}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center gap-1.5 text-emerald-700 text-[10px]">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Propagated to all {selectedDoc.chunkCount} vector chunks</span>
                  </div>
                </div>
              )}

              {/* Persona Access Simulation */}
              {personaEvaluation && activeTestPersona && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Can {activeTestPersona.name} Access?</span>
                    {personaEvaluation.canAccess ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold font-mono">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        ACCESS GRANTED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-700 font-bold font-mono">
                        <XCircle className="w-3.5 h-3.5" />
                        ACCESS BLOCKED
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-700 leading-relaxed bg-white p-2 rounded border border-slate-100">
                    {personaEvaluation.reason}
                  </div>

                  {/* Criteria Checklist */}
                  <div className="grid grid-cols-3 gap-1 pt-1 text-[10px] font-mono text-center">
                    <div
                      className={`p-1 rounded ${
                        personaEvaluation.tenantMatch
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-rose-50 text-rose-800'
                      }`}
                    >
                      Tenant {personaEvaluation.tenantMatch ? '✓' : '✗'}
                    </div>
                    <div
                      className={`p-1 rounded ${
                        personaEvaluation.clearanceMatch
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-rose-50 text-rose-800'
                      }`}
                    >
                      Clearance {personaEvaluation.clearanceMatch ? '✓' : '✗'}
                    </div>
                    <div
                      className={`p-1 rounded ${
                        personaEvaluation.roleMatch
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-rose-50 text-rose-800'
                      }`}
                    >
                      Role {personaEvaluation.roleMatch ? '✓' : '✗'}
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              {selectedDoc && (
                <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                  <button
                    onClick={() => onEditDocAcl(selectedDoc)}
                    className="w-full py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium transition-colors"
                  >
                    Edit Document ACL
                  </button>

                  {/* Quick role revocation helper */}
                  {selectedDoc.acl.allowed_roles.length > 1 && (
                    <div className="text-[11px] space-y-1">
                      <span className="text-slate-500 font-medium block">
                        One-Click Revoke Role to Test Propagation:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {selectedDoc.acl.allowed_roles
                          .filter((r) => r !== '*')
                          .map((role) => (
                            <button
                              key={role}
                              onClick={async () => {
                                setRevokingRole(role);
                                await onRevokeRole(selectedDoc.id, role);
                                setRevokingRole(null);
                              }}
                              disabled={revokingRole === role}
                              className="py-0.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[10px] font-mono transition-colors"
                            >
                              - Revoke '{role}'
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-slate-400 space-y-2">
              <Layers className="w-8 h-8 mx-auto text-slate-300" />
              <div className="text-xs font-medium text-slate-600">
                Select Any Node in the Graph
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Click on any Tenant, Document, Chunk, or Role node to inspect its exact payload propagation, vector index status, and persona clearance validation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
