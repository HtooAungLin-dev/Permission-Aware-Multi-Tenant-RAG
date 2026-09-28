import { ClassificationLevel, Document, UserPersona } from '../types/rag';

export const TENANTS = [
  {
    id: 'tenant_acme',
    name: 'Acme Corporation',
    domain: 'acme.io',
    industry: 'Enterprise Cloud & Infrastructure',
    color: '#3b82f6',
  },
  {
    id: 'tenant_apexbio',
    name: 'ApexBio Therapeutics',
    domain: 'apexbio.med',
    industry: 'Oncology & Genomic Medicine',
    color: '#10b981',
  },
  {
    id: 'tenant_horizon',
    name: 'Horizon Financial Group',
    domain: 'horizoncap.com',
    industry: 'Quantitative Hedge Fund & Asset Management',
    color: '#8b5cf6',
  },
];

export const USER_PERSONAS: UserPersona[] = [
  {
    id: 'usr_alice',
    name: 'Alice Vance',
    email: 'alice@acme.io',
    tenant_id: 'tenant_acme',
    tenant_name: 'Acme Corporation',
    roles: ['admin', 'executive'],
    classification_clearance: 'restricted',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    description: 'Acme Chief Operating Officer. Full access to Acme public, internal, confidential, and restricted Project Titan files.',
  },
  {
    id: 'usr_bob',
    name: 'Bob Chen',
    email: 'bob.c@acme.io',
    tenant_id: 'tenant_acme',
    tenant_name: 'Acme Corporation',
    roles: ['engineer'],
    classification_clearance: 'internal',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    description: 'Acme Senior Infrastructure Engineer. Authorized for Acme public and internal architecture documents. Cannot view Acme executive salaries or other tenants.',
  },
  {
    id: 'usr_charlie',
    name: 'Charlie Davis',
    email: 'charlie.d@acme.io',
    tenant_id: 'tenant_acme',
    tenant_name: 'Acme Corporation',
    roles: ['hr'],
    classification_clearance: 'confidential',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    description: 'Acme HR Director. Authorized for Acme public, internal, and confidential compensation documents.',
  },
  {
    id: 'usr_diana',
    name: 'Dr. Diana Prince',
    email: 'diana.p@apexbio.med',
    tenant_id: 'tenant_apexbio',
    tenant_name: 'ApexBio Therapeutics',
    roles: ['chief_medical_officer', 'researcher'],
    classification_clearance: 'confidential',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    description: 'ApexBio Chief Medical Officer. Full access to ApexBio public releases, lab SOPs, and confidential unblinded Phase III clinical trials.',
  },
  {
    id: 'usr_edward',
    name: 'Edward Miller',
    email: 'edward.m@apexbio.med',
    tenant_id: 'tenant_apexbio',
    tenant_name: 'ApexBio Therapeutics',
    roles: ['lab_tech'],
    classification_clearance: 'internal',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    description: 'ApexBio Junior Lab Technician. Can view public papers and internal lab SOPs. Strictly blocked from confidential clinical trial unblinded records.',
  },
  {
    id: 'usr_frank',
    name: 'Frank Reynolds',
    email: 'frank.r@horizoncap.com',
    tenant_id: 'tenant_horizon',
    tenant_name: 'Horizon Financial Group',
    roles: ['wealth_manager'],
    classification_clearance: 'confidential',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    description: 'Horizon Private Wealth Manager. Authorized for Horizon financial disclosures, quant alpha guides, and confidential HNW client portfolios.',
  },
  {
    id: 'usr_mallory',
    name: 'Mallory (Adversary)',
    email: 'mallory@external-attacker.net',
    tenant_id: 'tenant_acme',
    tenant_name: 'Acme Corporation (Compromised Guest)',
    roles: ['guest'],
    classification_clearance: 'public',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    description: 'Adversary testing cross-tenant leaks, request-body tenant tampering, role spoofing, and prompt injection attacks.',
  },
];

export const INITIAL_DOCUMENTS: Document[] = [
  // --- ACME CORP (tenant_acme) ---
  {
    id: 'doc_acme_handbook',
    title: 'Acme Corp 2026 Employee Handbook & Perks',
    category: 'Human Resources',
    tenant_id: 'tenant_acme',
    tenant_name: 'Acme Corporation',
    acl: {
      tenant_id: 'tenant_acme',
      allowed_roles: ['*'], // all authenticated roles in Acme
      allowed_users: [],
      classification_level: 'public',
    },
    summary: 'General employee policies, 401(k) matching up to 5%, flexible remote work stipend of $1,200 annually, and medical health benefits.',
    content: `Acme Corporation Employee Handbook 2026.
Welcome to Acme Corp. Our mission is delivering mission-critical enterprise cloud infrastructure.
Section 1: Work Environment and Remote Policy. Employees are eligible for $1,200 annual work-from-home stipend. Flexible hybrid schedule allows up to 3 days remote work per week.
Section 2: Health and Retirement Benefits. Acme offers 100% employer-sponsored health, dental, and vision insurance for employees and 80% for dependents. 401(k) retirement contributions are matched 100% up to the first 5% of base salary.
Section 3: Paid Time Off. Full-time personnel receive 20 days paid vacation annually plus 10 paid statutory holidays.
Section 4: Standard Office Code of Conduct. Mutual respect, security awareness, and adherence to security training protocols are required for all team members.`,
    createdAt: '2026-01-15T09:00:00Z',
    updatedAt: '2026-01-15T09:00:00Z',
    chunkCount: 3,
  },
  {
    id: 'doc_acme_infra',
    title: 'Acme Cloud Infrastructure & Kubernetes Architecture',
    category: 'Engineering Architecture',
    tenant_id: 'tenant_acme',
    tenant_name: 'Acme Corporation',
    acl: {
      tenant_id: 'tenant_acme',
      allowed_roles: ['engineer', 'admin', 'executive'],
      allowed_users: [],
      classification_level: 'internal',
    },
    summary: 'Technical specifications of Acme multi-region Kubernetes clusters, Redis caching topology, and Envoy service mesh configurations.',
    content: `Acme Cloud Platform Technical Architecture Specification (Q1 2026).
Architecture Overview: Acme production infrastructure operates across three active-active AWS regions (us-east-1, us-west-2, eu-west-1).
Cluster Orchestration: We utilize managed EKS 1.30 clusters with Cilium CNI and eBPF observability. Workloads are partitioned via Kubernetes namespaces with strictly enforced NetworkPolicies.
Caching & Data Tier: Primary persistence relies on distributed PostgreSQL with PgBouncer connection pooling. Redis 7.2 clusters with in-memory persistence provide sub-millisecond session caching and rate-limiting counters.
Service Mesh & Security: Istio service mesh enforces mutual TLS (mTLS) with SPIFFE/SPIRE x509 cryptographic identities. All ingress traffic traverses Envoy gateways with Cloudflare Web Application Firewall (WAF) filtering.
Observability: Prometheus agent scrapes OpenTelemetry metrics with Grafana dashboards and Datadog synthetic monitors.`,
    createdAt: '2026-02-10T14:30:00Z',
    updatedAt: '2026-02-10T14:30:00Z',
    chunkCount: 4,
  },
  {
    id: 'doc_acme_comp',
    title: 'Acme Corp Executive Compensation & C-Suite Salary Ledger',
    category: 'Confidential HR & Payroll',
    tenant_id: 'tenant_acme',
    tenant_name: 'Acme Corporation',
    acl: {
      tenant_id: 'tenant_acme',
      allowed_roles: ['hr', 'admin', 'executive'],
      allowed_users: ['usr_charlie', 'usr_alice'],
      classification_level: 'confidential',
    },
    summary: 'Strictly confidential salary, bonus multipliers, and equity grants for C-suite executives at Acme Corporation for fiscal year 2026.',
    content: `STRICTLY CONFIDENTIAL - ACME CORP BOARD AUDIT & COMPENSATION COMMITTEE.
Fiscal Year 2026 Executive Compensation Ledger.
Authorized Access: Chief Operating Officer, HR Director, Compensation Committee Board Members.
1. Chief Executive Officer (CEO - Marcus Vance):
   Base Salary: $1,450,000 USD
   Performance Incentive Target: 150% of base ($2,175,000)
   Equity Grant: 180,000 RSUs vesting quarterly over 4 years.
2. Chief Technology Officer (CTO - Elena Rostova):
   Base Salary: $890,000 USD
   Annual Target Bonus: 80% ($712,000)
   Equity Grant: 110,000 RSUs.
3. Chief Operating Officer (COO - Alice Vance):
   Base Salary: $920,000 USD
   Annual Target Bonus: 90% ($828,000)
   Equity Grant: 125,000 RSUs.
4. VP of Engineering (David Kim):
   Base Salary: $520,000 USD
   Bonus: 50% ($260,000)
   Equity: 45,000 RSUs.
Total 2026 C-Suite Cash Reserve Allocation: $8,940,000. Any unauthorized disclosure constitutes gross breach of employment agreement.`,
    createdAt: '2026-03-01T11:15:00Z',
    updatedAt: '2026-03-01T11:15:00Z',
    chunkCount: 3,
  },
  {
    id: 'doc_acme_m_and_a',
    title: 'Project Titan: Acquisition of NovaScale AI ($45M Term Sheet)',
    category: 'M&A Board Filings',
    tenant_id: 'tenant_acme',
    tenant_name: 'Acme Corporation',
    acl: {
      tenant_id: 'tenant_acme',
      allowed_roles: ['executive'],
      allowed_users: ['usr_alice'],
      classification_level: 'restricted',
    },
    summary: 'Restricted board-level M&A term sheet for the $45 million all-cash acquisition of NovaScale AI, including technical diligence and IP transfer.',
    content: `PROJECT TITAN - PRIVILEGED BOARD MATERIAL.
Target Entity: NovaScale AI Inc. (Delaware C-Corp).
Deal Structure: 100% all-cash stock purchase for total enterprise valuation of $45,000,000 USD.
Key Asset Evaluation: NovaScale owns proprietary transformer quantization kernels that reduce LLM inference latency by 64% on commodity GPUs.
Anticipated Closing Date: Q3 2026.
Non-Disclosure & Insider Trading Notice: This document contains material non-public information (MNPI) subject to SEC regulations and Acme black-out trading window restrictions.
Sole Designated Custodian: Alice Vance (COO).`,
    createdAt: '2026-03-12T16:00:00Z',
    updatedAt: '2026-03-12T16:00:00Z',
    chunkCount: 2,
  },

  // --- APEXBIO THERAPEUTICS (tenant_apexbio) ---
  {
    id: 'doc_apex_press',
    title: 'ApexBio Announces Positive Phase 1 Trial Safety for APX-702',
    category: 'Public Relations & Research',
    tenant_id: 'tenant_apexbio',
    tenant_name: 'ApexBio Therapeutics',
    acl: {
      tenant_id: 'tenant_apexbio',
      allowed_roles: ['*'],
      allowed_users: [],
      classification_level: 'public',
    },
    summary: 'Public press release announcing successful completion of Phase 1 clinical trial safety benchmarks for small-molecule kinase inhibitor APX-702.',
    content: `ApexBio Therapeutics Press Release (Boston, MA - February 2026).
ApexBio Therapeutics today announced the successful completion of its Phase 1 clinical trial evaluating APX-702, a selective oral kinase inhibitor targeting refractory solid tumors.
The Phase 1 trial evaluated 36 adult patients across dose-escalation cohorts ranging from 25mg to 300mg daily.
Primary Safety Findings: APX-702 was well tolerated with no dose-limiting toxicities (DLTs) observed at or below the recommended Phase 2 dose (RP2D) of 150mg once daily.
Dr. Diana Prince, Chief Medical Officer, noted: 'The favorable safety profile and preliminary pharmacokinetic linearity demonstrate significant promise for our upcoming multicenter Phase 2/3 trials.'`,
    createdAt: '2026-02-18T08:30:00Z',
    updatedAt: '2026-02-18T08:30:00Z',
    chunkCount: 3,
  },
  {
    id: 'doc_apex_sop',
    title: 'ApexBio BSL-3 Cleanroom Decontamination Protocol & Reagent SOP',
    category: 'Laboratory Operations',
    tenant_id: 'tenant_apexbio',
    tenant_name: 'ApexBio Therapeutics',
    acl: {
      tenant_id: 'tenant_apexbio',
      allowed_roles: ['researcher', 'lab_tech', 'chief_medical_officer'],
      allowed_users: [],
      classification_level: 'internal',
    },
    summary: 'Standard operating procedure for vaporized hydrogen peroxide (VHP) decontamination and cryogenic storage of viral vectors in facility B-4.',
    content: `ApexBio SOP-LAB-409: BSL-3 Cleanroom Containment and Decontamination Protocols.
Scope: Applicable to all laboratory technicians and scientific staff operating within Cambridge Facility Wing B-4.
Sterilization Parameters: Vaporized Hydrogen Peroxide (VHP) cycles must maintain 450 ppm concentration for minimum 120 minutes dwell time at 22°C and 40% relative humidity.
Reagent Handling: CRISPR/Cas9 ribonucleoprotein complexes and lentiviral vectors must be preserved in liquid nitrogen vapor phase storage (-180°C).
Personal Protective Equipment (PPE): Powered air-purifying respirators (PAPR), double nitrile gloves, and Tyvek positive-pressure suits are mandatory prior to ante-room airlock entry.`,
    createdAt: '2026-01-22T10:00:00Z',
    updatedAt: '2026-01-22T10:00:00Z',
    chunkCount: 3,
  },
  {
    id: 'doc_apex_trial_unblinded',
    title: 'APX-702 Phase III Unblinded Clinical Trial Efficacy & Adverse Events',
    category: 'Clinical Trial Data',
    tenant_id: 'tenant_apexbio',
    tenant_name: 'ApexBio Therapeutics',
    acl: {
      tenant_id: 'tenant_apexbio',
      allowed_roles: ['chief_medical_officer'],
      allowed_users: ['usr_diana'],
      classification_level: 'confidential',
    },
    summary: 'Unblinded Phase III patient survival curves, 83% complete remission in Cohort B, and 3 acute myocarditis adverse events in high-dose Cohort C.',
    content: `CONFIDENTIAL MEDICAL TRIAL DATA - FDA / EMA REGULATORY COMMITTEE ONLY.
Study Protocol: APX-702-CLIN-301 Unblinded Interim Efficacy and Safety Ledger.
Trial Investigator: Dr. Diana Prince, MD, PhD (CMO).
1. Primary Endpoint Efficacy:
   - Cohort A (Control / Standard of Care): 14.2% progression-free survival (PFS) at 12 months.
   - Cohort B (APX-702 150mg monotherapy): 83.4% complete or partial metabolic remission rate (p < 0.001). Median PFS extended to 22.8 months.
2. Severe Adverse Events (SAEs):
   - Patient ID APX-B-104: Grade 4 acute myocarditis with troponin elevation (>12 ng/mL). Patient successfully stabilized following corticosteroid intervention.
   - Patient ID APX-B-209: Grade 3 reversible hepatotoxicity (ALT/AST > 5x ULN).
3. Gene Sequencing Biomarker:
   Tumors with EGFR Exon 20 insertion mutations demonstrated 94% response rate.
WARNING: Unauthorized publication will immediately compromise ongoing double-blind regulatory approval with the FDA.`,
    createdAt: '2026-03-14T17:45:00Z',
    updatedAt: '2026-03-14T17:45:00Z',
    chunkCount: 3,
  },

  // --- HORIZON FINANCIAL (tenant_horizon) ---
  {
    id: 'doc_horizon_sec',
    title: 'Horizon Financial SEC Form 10-Q & Shareholder Summary',
    category: 'Regulatory Disclosures',
    tenant_id: 'tenant_horizon',
    tenant_name: 'Horizon Financial Group',
    acl: {
      tenant_id: 'tenant_horizon',
      allowed_roles: ['*'],
      allowed_users: [],
      classification_level: 'public',
    },
    summary: 'Public quarterly filing outlining assets under management ($14.8B), liquidity reserves, and compliance oversight frameworks.',
    content: `Horizon Financial Group, Inc. SEC Form 10-Q Quarterly Filing.
Fiscal Quarter Ended December 31, 2025.
Consolidated Statement of Financial Condition:
Assets Under Management (AUM): Total AUM reached $14.82 Billion USD across our Global Quantitative Strategies, Fixed Income Arbitrage, and Private Wealth divisions.
Capital Adequacy & Liquidity: Cash and cash equivalents totaled $1.64 Billion. The firm maintains leverage ratios strictly within FINRA and SEC regulatory covenants.
Risk Management: Value at Risk (VaR) 99% 1-day threshold remained below 1.4% of total firm equity throughout the reporting period.`,
    createdAt: '2026-01-28T12:00:00Z',
    updatedAt: '2026-01-28T12:00:00Z',
    chunkCount: 3,
  },
  {
    id: 'doc_horizon_quant',
    title: 'Horizon Statistical Arbitrage Execution Algorithm (Project Chronos)',
    category: 'Trading Algorithms',
    tenant_id: 'tenant_horizon',
    tenant_name: 'Horizon Financial Group',
    acl: {
      tenant_id: 'tenant_horizon',
      allowed_roles: ['quant', 'trader', 'wealth_manager'],
      allowed_users: [],
      classification_level: 'internal',
    },
    summary: 'Proprietary algorithmic execution logic, FPGA co-location order routing at CME and NASDAQ, and mean-reversion signal thresholds.',
    content: `Horizon Quantitative Research Technical Memo - Project Chronos (v4.2).
Author: Quantitative Strategies Desk.
Execution Engine: Project Chronos operates via FPGA-accelerated network interfaces colocated at CME Aurora and Equinix NY4 data centers.
Signal Formulation: Microsecond order book imbalance (OBI) combined with cross-asset statistical mean reversion across S&P 500 E-mini futures and constituent equities.
Risk Controls: Automated circuit breakers liquidate positions if single-name drawdown exceeds 35 basis points within any 5-minute rolling window.
Daily Sharpe Ratio: Maintained annualized Sharpe ratio of 3.84 over past 250 trading days.`,
    createdAt: '2026-02-25T15:20:00Z',
    updatedAt: '2026-02-25T15:20:00Z',
    chunkCount: 3,
  },
  {
    id: 'doc_horizon_hnw_portfolios',
    title: 'Horizon High-Net-Worth VIP Client Portfolios & Cayman Holdings',
    category: 'Private Wealth Management',
    tenant_id: 'tenant_horizon',
    tenant_name: 'Horizon Financial Group',
    acl: {
      tenant_id: 'tenant_horizon',
      allowed_roles: ['wealth_manager'],
      allowed_users: ['usr_frank'],
      classification_level: 'confidential',
    },
    summary: 'Private wealth accounts, Cayman Trust entity allocations, and confidential tax-sheltered portfolios managed by Frank Reynolds.',
    content: `STRICTLY PRIVATE WEALTH CONFIDENTIAL - FRANK REYNOLDS CLIENT DESK.
VIP Client Portfolio Ledger & Offshore Trust Structures.
1. Account ID #HW-9941 (Valhalla Trust, Cayman Islands):
   Total Net Asset Value: $240,500,000 USD.
   Asset Breakdown: 45% physical gold stored in Zurich vaults, 35% Swiss private credit notes, 20% Horizon Chronos Alpha fund shares.
2. Account ID #HW-8812 (Castleton Family Foundation, Luxembourg):
   Total Net Asset Value: $118,200,000 USD.
   Beneficiary: Dual-citizenship estate planning vehicle with 0% withholding treaty allocation.
Access Restriction: Fiduciary confidentiality is legally protected under Swiss Banking Act Article 47. Only authorized wealth managers may review portfolio holdings.`,
    createdAt: '2026-03-05T13:10:00Z',
    updatedAt: '2026-03-05T13:10:00Z',
    chunkCount: 3,
  },
];

/**
 * Generate a cryptographically styled JWT token for a given user persona
 */
export function issueUserToken(user: UserPersona): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const payload = {
    sub: user.id,
    name: user.name,
    email: user.email,
    tenant_id: user.tenant_id,
    roles: user.roles,
    clearance: user.classification_clearance,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 * 24, // 24 hours
    jti: `jwt_${Math.random().toString(36).substring(2, 10)}`,
  };

  // Standard base64url encoding
  const b64Url = (obj: any) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const encodedHeader = b64Url(header);
  const encodedPayload = b64Url(payload);
  
  // Simulated HMAC-SHA256 signature representation
  const secretKey = 'ENTERPRISE_RAG_SECURE_HMAC_SECRET_KEY_2026';
  const rawSig = `${encodedHeader}.${encodedPayload}.${secretKey}`;
  const encodedSignature = Buffer.from(rawSig).toString('base64').substring(0, 32).replace(/\+/g, '-').replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}
