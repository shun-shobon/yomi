import OpenAI, { APIError } from "openai";

import type { ModelInfo } from "@/domain/models";
import { isReasoningEffort, type ReasoningEffort } from "@/domain/settings";

/** API の失敗。HTTP 応答前やストリーム途中の失敗は status を持たない */
export class ApiError extends Error {
  constructor(
    readonly status: number | null,
    readonly code: string | null,
    message: string,
  ) {
    super(message);
  }
}

function createClient(token: string): OpenAI {
  return new OpenAI({
    apiKey: token,
    // 拡張の service worker はブラウザ環境と判定される。キーはユーザー本人の OAuth トークンで、第三者には渡らない
    dangerouslyAllowBrowser: true,
    // 再試行は refresh を挟む withAuthRetry 側で制御する
    maxRetries: 0,
  });
}

/** Codex の Fast モードと同じく、この service tier をモデルが提供していれば優先処理を使える */
const FAST_SERVICE_TIER = "priority";

interface SiwcModel {
  slug: string;
  display_name: string;
  visibility: string;
  default_reasoning_level: string;
  supported_reasoning_levels: { effort: string }[];
  service_tiers: { id: string }[];
}

export async function listModels(token: string): Promise<ModelInfo[]> {
  // SIWC の /models は data ではなく models 配列を返すため、SDK の models.list() ではなく汎用 get を使う
  const { models } = await withApiErrors(() =>
    createClient(token).get<{ models: SiwcModel[] }>("/models"),
  );
  return models.filter((m) => m.visibility === "list").map(toModelInfo);
}

function toModelInfo(m: SiwcModel): ModelInfo {
  if (!isReasoningEffort(m.default_reasoning_level)) {
    throw new Error(
      `${m.slug} の既定の reasoning effort が未知の値です: ${m.default_reasoning_level}`,
    );
  }
  return {
    slug: m.slug,
    displayName: m.display_name,
    // SDK が知らない新しい effort は送れないので選択肢に出さない
    reasoningEfforts: m.supported_reasoning_levels
      .map(({ effort }) => effort)
      .filter(isReasoningEffort),
    defaultReasoningEffort: m.default_reasoning_level,
    supportsFast: m.service_tiers.some((tier) => tier.id === FAST_SERVICE_TIER),
  };
}

export interface StreamOptions {
  token: string;
  model: string;
  reasoningEffort: ReasoningEffort;
  fast: boolean;
  instructions: string;
  input: string;
  signal: AbortSignal;
  onDelta: (text: string) => void;
}

/** SIWC は stream: true / store: false が必須。response.completed を受け取った場合だけ成功とみなす */
export async function streamResponse(opts: StreamOptions): Promise<void> {
  const stream = await withApiErrors(() =>
    createClient(opts.token).responses.create(
      {
        model: opts.model,
        instructions: opts.instructions,
        input: [{ role: "user", content: opts.input }],
        reasoning: { effort: opts.reasoningEffort },
        ...(opts.fast && { service_tier: FAST_SERVICE_TIER }),
        store: false,
        stream: true,
      },
      { signal: opts.signal },
    ),
  );
  for await (const event of stream) {
    switch (event.type) {
      case "response.output_text.delta":
        opts.onDelta(event.delta);
        break;
      case "response.completed":
        return;
      case "response.failed":
      case "response.incomplete": {
        const { error } = event.response;
        throw new ApiError(null, error?.code ?? null, error?.message ?? event.type);
      }
      case "error":
        throw new ApiError(null, event.code, event.message);
    }
  }
  throw new ApiError(null, null, "応答が途中で終了しました");
}

async function withApiErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!(e instanceof APIError) || e.status === undefined) throw e;
    const message = e.requestID ? `${e.message} (request id: ${e.requestID})` : e.message;
    throw new ApiError(e.status, e.code ?? null, message);
  }
}
