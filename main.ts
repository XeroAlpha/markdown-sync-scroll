import { MarkdownView, Plugin } from 'obsidian';

declare module 'obsidian' {
	interface WorkspaceLeaf {
		group: string | null;
		working: boolean;
	}

    interface MarkdownViewEphemeralState {
        scroll: number;
    }

	interface MarkdownView {
        receiveSyncState(this: MarkdownView, view: MarkdownView): void;
        syncScroll(this: MarkdownView): void;
        getEphemeralState(): MarkdownViewEphemeralState;
        setEphemeralState(state: MarkdownViewEphemeralState): void;
	}
}

const MarkdownViewSyncScroll = new WeakMap<MarkdownView, { offset: number, group: string | null }>();
const MarkdownViewScrolling = new WeakMap<MarkdownView, boolean>();
function getOrRefreshScrollSyncOffset(view: MarkdownView, group: string | null) {
    const scroll = MarkdownViewSyncScroll.get(view);
    if (!scroll || !group || scroll.group !== group) {
        const currentScroll = view.currentMode.getScroll();
        MarkdownViewSyncScroll.set(view, { offset: currentScroll, group });
        return currentScroll;
    }
    return scroll.offset;
}

export default class MarkdownSyncScrollPlugin extends Plugin {
	originalReceiveSyncState: MarkdownView['receiveSyncState'];
    originalSyncScroll: MarkdownView['syncScroll'];

	async onload() {
		this.originalReceiveSyncState = MarkdownView.prototype.receiveSyncState;
		this.originalSyncScroll = MarkdownView.prototype.syncScroll;
        const originalReceiveSyncState = this.originalReceiveSyncState;
        const originalSyncScroll = this.originalSyncScroll;
        MarkdownView.prototype.receiveSyncState = function(sourceView) {
            if (MarkdownViewScrolling.get(sourceView)) {
                if (this.leaf.working) {
                    return false;
                }
                const destScrollOffset = getOrRefreshScrollSyncOffset(this, this.leaf.group);
                const srcScrollOffset = getOrRefreshScrollSyncOffset(sourceView, sourceView.leaf.group);
                const eState = { ...sourceView.getEphemeralState() };
                eState.scroll += destScrollOffset - srcScrollOffset;
                this.setEphemeralState(eState);
                return true;
            } else {
                return originalReceiveSyncState.call(this, sourceView);
            }
        };
        MarkdownView.prototype.syncScroll = function(...args) {
            MarkdownViewScrolling.set(this, true);
            const result = originalSyncScroll.call(this, args);
            MarkdownViewScrolling.set(this, false);
            return result;
        };
	}

	onunload() {
		MarkdownView.prototype.receiveSyncState = this.originalReceiveSyncState;
		MarkdownView.prototype.syncScroll = this.originalSyncScroll;
	}
}
