# TrustGate — Reputation-Aware x402 Payments for AI Agents on Hedera

**Track:** ETHOnline 2026 — "AI & Agentic Payments on Hedera"  
**Status:** MVP Development

## Short Description

Trust-aware x402 payments for autonomous AI agents on Hedera.

## Description

TrustGate is a reputation-aware payment layer for autonomous AI agents built on Hedera. It extends x402 pay-per-request payments with a verifiable trust mechanism that evaluates an agent's transaction history before deciding how its payment should be handled.

When an agent discovers and requests a paid service, TrustGate checks its on-chain reputation. New or low-reputation agents are routed through a protected payment flow using Hedera Scheduled Transactions, allowing the payment to be held while the service is delivered and resolved according to the escrow policy. Agents with an established history of successful interactions can use the standard x402 settlement path with significantly lower friction and latency.

Each payment, delivery outcome, and trust decision is recorded through Hedera Consensus Service (HCS), creating a publicly verifiable audit trail. This gives autonomous agents a way to progressively establish trust through successful transactions rather than relying solely on static identities or centralized reputation systems.

The MVP demonstrates an end-to-end agentic commerce flow: service discovery, x402 payment, reputation evaluation, adaptive settlement, service delivery, and on-chain reputation updates.

> **Core idea:** The more an agent proves it can transact successfully, the less friction it faces when paying for services.

---

## 1. Problem

AI agents are increasingly capable of discovering services, invoking APIs, and making payments autonomously. However, autonomous commerce requires more than a payment rail: agents need a way to establish trust with services and counterparties they have never interacted with before.

x402 provides a standardized mechanism for pay-per-request HTTP services, but the basic payment flow does not determine how much payment risk should be taken based on a caller's history. A first-time agent and an agent with a long history of successful interactions can therefore face essentially the same payment experience.

This creates a trust gap for agentic commerce:

- **New agents have no established history.**
- **Providers have limited information about caller behavior.**
- **Payment settlement is not inherently reputation-aware.**
- **A successful interaction does not automatically become a portable, verifiable trust signal.**
- **Agents need low-friction payments once they have demonstrated reliable behavior.**

TrustGate addresses this by placing a reputation and policy layer around x402 payments on Hedera.

---

## 2. Solution

TrustGate acts as an adaptive payment gateway between an AI agent and an x402-protected service.

Instead of using one payment path for every caller, TrustGate evaluates the caller's verifiable transaction history and selects an appropriate settlement policy.

### New / Low-Reputation Agent

A first-time or low-reputation agent is treated as unverified.

Its payment follows a protected Scheduled Transaction-based flow:

1. The agent requests the paid resource.
2. The service returns an x402 payment requirement.
3. TrustGate evaluates the agent's reputation.
4. The payment is placed into the protected flow.
5. The service attempts to deliver the requested resource.
6. The payment is resolved according to the configured delivery/timeout policy.
7. The interaction outcome is recorded as part of the agent's reputation history.

### Established Agent

After an agent has accumulated a sufficient history of successful interactions, TrustGate classifies it as trusted.

The agent can then use the standard x402 verification and settlement flow without the additional protected-payment path.

For the MVP, the initial trust policy is:

```text
3+ successful interactions
        ↓
   Trusted caller
        ↓
 Standard x402 settlement
```

The threshold is intentionally simple for the MVP and can later evolve into a richer reputation model.

---

## 3. Why Hedera

TrustGate uses Hedera primitives to make the trust layer verifiable rather than purely centralized.

### x402

x402 provides the payment protocol for machine-to-machine HTTP payments.

TrustGate uses the Hedera implementation of the x402 exact payment scheme and the facilitator for payment verification and settlement.

### HCS — Hedera Consensus Service

HCS is used as the append-only audit and reputation layer.

Payment outcomes and TrustGate policy decisions can be published as messages containing information such as:

- Caller identity
- Service/resource
- Payment transaction
- Payment amount and asset
- Interaction outcome
- Reputation classification
- Policy reason
- Settlement path
- Scheduled Transaction identifier when applicable
- Timestamp
- HashScan verification reference

This creates a publicly verifiable history of the interactions used by the policy engine.

### Hedera Scheduled Transactions

Scheduled Transactions are used for the protected payment path for new or low-reputation agents.

The MVP uses a configurable timeout window so that an interaction does not require an indefinite manual settlement process.

---

## 4. MVP Architecture

```text
                         ┌─────────────────────────────┐
                         │       HCS-10 Discovery       │
                         │   Service Profile / Registry │
                         └──────────────┬──────────────┘
                                        │
                                        │ Discover
                                        ▼
┌──────────────────┐             ┌──────────────────────┐
│  Consumer Agent  │────────────▶│   TrustGate Service  │
│                  │   Request   │    / x402 Server     │
│ Hedera Agent Kit │◀────────────│                      │
│ + x402 Client    │   402       └──────────┬───────────┘
└──────────────────┘                         │
                                            │
                                            ▼
                                  ┌─────────────────────┐
                                  │  Reputation Engine  │
                                  │                     │
                                  │  Read HCS history   │
                                  │  Apply policy       │
                                  └──────────┬──────────┘
                                             │
                         ┌───────────────────┴───────────────────┐
                         │                                       │
                    Trusted                                  Unverified
                         │                                       │
                         ▼                                       ▼
              ┌────────────────────┐                 ┌────────────────────┐
              │ x402 Facilitator   │                 │ Scheduled Tx Flow  │
              │ verify + settle    │                 │ Protected payment  │
              └─────────┬──────────┘                 └─────────┬──────────┘
                        │                                      │
                        └──────────────────┬───────────────────┘
                                           │
                                           ▼
                                  ┌─────────────────────┐
                                  │    Service Delivery │
                                  └──────────┬──────────┘
                                             │
                                             ▼
                                  ┌─────────────────────┐
                                  │   HCS Audit/History │
                                  │ Payment + Outcome   │
                                  └─────────────────────┘
```

---

## 5. Core Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| Resource Server | Node.js + Express + x402 | Provides the paid AI/service endpoint |
| Consumer Agent | Hedera Agent Kit + x402 | Discovers and consumes the service |
| Reputation Ledger | HCS | Records interaction history and outcomes |
| Policy Engine | Node.js | Classifies callers and selects payment path |
| Payment Layer | x402 + Hedera facilitator | Verifies and settles standard payments |
| Protected Payment | Hedera Scheduled Transactions | Handles the new/low-reputation payment path |
| Discovery | HCS-10 / Registry Broker | Makes the service discoverable to agents |
| Verification | HashScan | Provides public transaction/audit verification |

---

## 6. Payment Flows

### Flow A — New Agent

```text
Agent
  │
  ├── Discover service
  │
  ├── Request resource
  │
  ├── Receive HTTP 402
  │
  ├── TrustGate checks HCS reputation
  │
  ├── Classified as UNVERIFIED
  │
  ├── Protected payment / Scheduled Transaction
  │
  ├── Service delivery
  │
  ├── Resolve according to delivery/timeout policy
  │
  └── Write outcome to HCS
```

### Flow B — Established Agent

```text
Agent
  │
  ├── Discover service
  │
  ├── Request resource
  │
  ├── Receive HTTP 402
  │
  ├── TrustGate checks HCS reputation
  │
  ├── Classified as TRUSTED
  │
  ├── Standard x402 verification
  │
  ├── Facilitator settlement
  │
  ├── Service delivery
  │
  └── Write outcome to HCS
```

---

## 7. Reputation Model

The MVP intentionally uses a simple, transparent policy.

```javascript
function classifyCaller(reputation) {
  if (
    reputation.callCount >= 3 &&
    reputation.successfulDeliveries === reputation.callCount
  ) {
    return {
      classification: "trusted",
      reasonCode: "SUFFICIENT_HISTORY"
    };
  }

  return {
    classification: "unverified",
    reasonCode:
      reputation.callCount === 0
        ? "NO_HISTORY"
        : "INSUFFICIENT_SUCCESS_HISTORY"
  };
}
```

The important design principle is that reputation is derived from verifiable interaction history rather than a manually assigned score.

The three-success threshold is an MVP policy, not a claim that three transactions constitute universally meaningful reputation.

---

## 8. HCS Reputation Record

A simplified interaction record can look like:

```json
{
  "caller": "0.0.xxxxx",
  "service": "trustgate-inference",
  "endpoint": "/inference",
  "amount": "0.05",
  "asset": "HBAR",
  "timestamp": "2026-09-08T14:30:00Z",
  "outcome": "delivered",
  "classification": "trusted",
  "reasonCode": "SUFFICIENT_HISTORY",
  "settlementPath": "instant",
  "transactionId": "0.0.xxxxx@timestamp",
  "scheduledTransactionId": null
}
```

For the protected path, the Scheduled Transaction identifier can be included in the record.

---

## 9. Service Discovery

TrustGate is intended to expose a machine-readable service profile through HCS-10 / a registry mechanism.

Example:

```json
{
  "serviceId": "trustgate-inference",
  "accountId": "0.0.provider",
  "name": "TrustGate Reputation-Gated Inference",
  "tags": [
    "ai-agents",
    "hedera",
    "x402",
    "inference",
    "payments"
  ],
  "price": {
    "asset": "HBAR",
    "amount": "0.05"
  },
  "description": "Pay-per-call AI inference service with reputation-aware settlement",
  "reputationPolicy": {
    "trustedThreshold": 3,
    "protectedTimeoutSeconds": 90
  }
}
```

Discovery is an enabling component of the MVP; the primary innovation remains reputation-aware payment routing.

---

## 10. Auditability

TrustGate is designed so that important payment decisions can be independently inspected.

The audit trail records:

```text
Payment
   ↓
Transaction ID
   ↓
Reputation lookup
   ↓
Policy decision
   ↓
Settlement path
   ↓
Delivery outcome
   ↓
HCS record
   ↓
HashScan verification
```

This allows the demo to show not only that a payment happened, but also **why TrustGate selected a particular payment path**.

---

## 11. Demo Scenario

The MVP demo should focus on one clear story.

### Step 1 — New Agent

A new agent discovers the TrustGate service and requests a paid inference endpoint.

TrustGate finds no successful history and routes the interaction through the protected payment path.

The transaction and policy decision are visible through Hedera tooling.

### Step 2 — Successful Delivery

The service successfully delivers the requested result.

The interaction is recorded in HCS as a successful delivery.

### Step 3 — Repeat

The same agent performs additional successful requests.

Its verifiable history grows.

### Step 4 — Trust Established

After the configured threshold is reached, TrustGate classifies the agent as trusted.

The next request follows the normal x402 settlement path.

### Step 5 — Show the Difference

The demo visibly compares:

```text
NEW AGENT
Protected settlement
Higher friction
↓
Successful history
↓
TRUSTED AGENT
Standard x402 settlement
Lower friction
```

This is the core product demonstration.

---

## 12. API

### Resource Endpoint

```http
GET /inference
```

Returns `402 Payment Required` when payment is required.

### Verification

```http
POST /verify
```

Used to verify the payment through the facilitator.

### Settlement

```http
POST /settle
```

Used for the standard x402 settlement flow where applicable.

### Reputation

```http
GET /reputation/:accountId
```

Returns the derived reputation state used by the TrustGate policy engine.

### Audit

```http
GET /audit/:accountId
```

Returns relevant interaction records and verification references.

---

## 13. Technology Stack

- **Hedera Testnet**
- **x402**
- **@x402/hedera**
- **Hedera Agent Kit**
- **Hedera Consensus Service (HCS)**
- **HCS-10 / Registry Broker**
- **Hedera Scheduled Transactions**
- **Node.js**
- **TypeScript**
- **Express**
- **HashScan**
- **x402 facilitator**

---

## 14. MVP Scope

### Required

- [ ] Live x402-gated service on Hedera testnet
- [ ] Consumer AI agent
- [ ] Real paid request
- [ ] Reputation lookup
- [ ] Reputation-based policy decision
- [ ] Trusted caller → standard x402 settlement
- [ ] New/low-reputation caller → protected payment path
- [ ] HCS interaction/audit records
- [ ] Public HashScan verification
- [ ] Service discovery

### Optional / Stretch

- [ ] HCS-14 UAID attachment
- [ ] HBAR + USDC support
- [ ] More sophisticated reputation scoring
- [ ] Multiple services sharing reputation
- [ ] Reputation decay / recency weighting
- [ ] Reputation portability across providers
- [ ] Compliance certificates using HTS NFTs

---

## 15. MVP Design Principles

TrustGate should remain focused on demonstrating the core concept rather than becoming a general-purpose payment platform.

### Keep the MVP focused on:

1. **One real x402 service**
2. **One consumer agent**
3. **One transparent reputation policy**
4. **Two payment paths**
5. **Real Hedera transactions**
6. **HCS-based auditability**
7. **A clear before/after trust demonstration**

The MVP does not attempt to solve every aspect of decentralized reputation, dispute resolution, Sybil resistance, or production-scale payment infrastructure.

---

## 16. Project Structure

```text
trustgate/
├── README.md
├── package.json
├── .env.example
├── ARCHITECTURE.md
├── DEMO_SCRIPT.md
│
├── SERVER/
│   ├── index.ts
│   ├── x402.ts
│   ├── reputation.ts
│   ├── policy.ts
│   ├── escrow.ts
│   └── audit.ts
│
├── AGENT/
│   ├── index.ts
│   ├── discovery.ts
│   ├── payment.ts
│   └── reputation.ts
│
├── DISCOVERY/
│   └── service-profile.ts
│
└── STRETCH/
    └── uaid-attachment.ts
```

---

## 17. References

- Hedera Agent Commerce Kit: https://github.com/hashgraph/hedera-agent-kit-js
- x402 Specification: https://github.com/x402/x402-spec
- x402 Facilitator: https://x402.org/facilitator
- Hedera Testnet Portal: https://portal.hedera.com
- HashScan Testnet: https://hashscan.io/testnet

---

## 18. Hackathon Positioning

TrustGate is not another AI service that happens to accept x402.

It demonstrates a missing layer for autonomous commerce:

> **Payment should become easier as an agent proves it can be trusted.**

The MVP combines x402 payments, Hedera-native scheduled transactions, HCS-based reputation history, service discovery, and an autonomous consumer agent into one end-to-end demonstration of **trust-aware agentic payments**.

---

**Status:** MVP Development  
**Target:** ETHOnline 2026 — AI & Agentic Payments on Hedera
