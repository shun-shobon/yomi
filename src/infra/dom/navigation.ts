export function isReload(): boolean {
	const [entry] = performance.getEntriesByType("navigation");
	return entry instanceof PerformanceNavigationTiming && entry.type === "reload";
}
