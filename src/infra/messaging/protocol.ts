import * as v from "valibot";

import { SerializedFailureSchema } from "@/domain/failure";
import { LanguageCodeSchema } from "@/domain/languages";
import { ModelInfoSchema } from "@/domain/models";

export const TRANSLATE_PORT = "translate";

export const TranslateRequestSchema = v.object({
	instructions: v.string(),
	input: v.string(),
});

export type TranslateRequest = v.InferOutput<typeof TranslateRequestSchema>;

export const TranslateEventSchema = v.variant("type", [
	v.object({ type: v.literal("delta"), text: v.string() }),
	v.object({ type: v.literal("done") }),
	v.object({ type: v.literal("error"), failure: SerializedFailureSchema }),
]);

export type TranslateEvent = v.InferOutput<typeof TranslateEventSchema>;

const AuthStateSchema = v.object({
	signedIn: v.boolean(),
	email: v.nullable(v.string()),
});

export type AuthState = v.InferOutput<typeof AuthStateSchema>;

const endpoint = <P extends v.GenericSchema, R extends v.GenericSchema>(params: P, result: R) => ({
	params,
	result,
});

export const BACKGROUND_API = {
	"auth:getState": endpoint(v.void(), AuthStateSchema),
	"auth:signIn": endpoint(v.void(), v.void()),
	"auth:signOut": endpoint(v.void(), v.void()),
	"models:list": endpoint(v.void(), v.array(ModelInfoSchema)),
	"open:options": endpoint(v.void(), v.void()),
	"open:usage": endpoint(v.void(), v.void()),
	"open:shortcuts": endpoint(v.void(), v.void()),
	"cache:lookup": endpoint(
		v.object({ pageUrl: v.string(), lang: LanguageCodeSchema, markups: v.array(v.string()) }),
		v.array(v.nullable(v.string())),
	),
	"cache:store": endpoint(
		v.object({
			pageUrl: v.string(),
			lang: LanguageCodeSchema,
			entries: v.array(v.object({ markup: v.string(), translation: v.string() })),
		}),
		v.void(),
	),
	"tab:getState": endpoint(
		v.void(),
		v.object({ offerDismissed: v.boolean(), translating: v.boolean() }),
	),
	"tab:setTranslating": endpoint(v.object({ translating: v.boolean() }), v.void()),
	"offer:dismiss": endpoint(v.void(), v.void()),
};

type BackgroundApi = typeof BACKGROUND_API;

export type BackgroundMethod = keyof BackgroundApi;

export type ParamsOf<K extends BackgroundMethod> = v.InferOutput<BackgroundApi[K]["params"]>;

export type ParamlessMethod = {
	[K in BackgroundMethod]: [ParamsOf<K>] extends [void] ? K : never;
}[BackgroundMethod];

export type ResultOf<K extends BackgroundMethod> = v.InferOutput<BackgroundApi[K]["result"]>;

export const BackgroundRequestSchema = v.object({
	type: v.custom<BackgroundMethod>(
		(type) => typeof type === "string" && Object.hasOwn(BACKGROUND_API, type),
	),
	// undefined のキーはメッセージングで落ちる。中身は type ごとのスキーマで検証する
	params: v.optional(v.unknown()),
});

export const BackgroundResponseSchema = v.variant("ok", [
	// undefined のキーはメッセージングで落ちる。中身は type ごとのスキーマで検証する
	v.object({ ok: v.literal(true), value: v.optional(v.unknown()) }),
	v.object({ ok: v.literal(false), failure: SerializedFailureSchema }),
]);

export type BackgroundResponse = v.InferOutput<typeof BackgroundResponseSchema>;

export const ContentMessageSchema = v.variant("type", [
	v.object({ type: v.literal("page:getState") }),
	v.object({ type: v.literal("page:translate") }),
	v.object({ type: v.literal("page:stop") }),
	v.object({ type: v.literal("page:showOriginal") }),
	v.object({ type: v.literal("page:showTranslation") }),
	v.object({ type: v.literal("command:translate") }),
	v.object({ type: v.literal("command:toggleOriginal") }),
	v.object({ type: v.literal("selection:translate"), text: v.string() }),
]);

export type ContentMessage = v.InferOutput<typeof ContentMessageSchema>;

export const CommandNameSchema = v.picklist(["translate-page", "toggle-original"]);

export type CommandName = v.InferOutput<typeof CommandNameSchema>;
