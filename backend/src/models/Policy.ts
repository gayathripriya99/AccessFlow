import { Schema, model, Document, Types } from 'mongoose';
import { toJSONOptions } from './schemaOptions';

/**
 * Attribute-Based Access Control (Phase 8) — a policy layer that sits
 * alongside RBAC, not instead of it. A policy matches a `resource`+`action`
 * pair and, if every condition holds, contributes an `allow` or `deny` vote
 * (see AbacService). An explicit `deny` always wins; an `allow` grants access
 * even without the matching RBAC permission; if no policy matches at all,
 * the caller falls back to the ordinary RBAC permission check.
 *
 * Conditions are structured (attribute/operator/compareTo), never a string
 * to `eval()` — the only attributes this domain actually has are `subject.id`
 * and `resource.id` (users don't otherwise "own" anything in this system),
 * so a small closed condition language is enough and avoids the security
 * risk of an arbitrary expression evaluator.
 */
export type PolicyEffect = 'allow' | 'deny';
export type PolicyOperator = 'equals' | 'notEquals';

export interface PolicyCondition {
  /** Dot-path into the evaluation context, e.g. "resource.id" or "subject.id". */
  attribute: string;
  operator: PolicyOperator;
  /** Another attribute path (resolved against the context) or a literal string. */
  compareTo: string;
}

export interface PolicyDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  resource: string;
  action: string;
  effect: PolicyEffect;
  conditions: PolicyCondition[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const policyConditionSchema = new Schema<PolicyCondition>(
  {
    attribute: { type: String, required: true, trim: true },
    operator: { type: String, required: true, enum: ['equals', 'notEquals'] },
    compareTo: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const policySchema = new Schema<PolicyDocument>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    resource: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    effect: {
      type: String,
      required: true,
      enum: ['allow', 'deny'],
    },
    conditions: {
      type: [policyConditionSchema],
      default: [],
    },
    enabled: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, toJSON: toJSONOptions },
);

export const Policy = model<PolicyDocument>('Policy', policySchema);
