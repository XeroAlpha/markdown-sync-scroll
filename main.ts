import { MarkdownView, Plugin, WorkspaceLeaf, OpenViewState } from 'obsidian';

const MarkdownViewScrollOffset = Symbol('MarkdownViewScrollOffset');
const MarkdownViewScrollGroup = Symbol('MarkdownViewScrollGroup');

declare module 'obsidian' {
	interface WorkspaceLeaf {
		group: string | null;
		workspace: Workspace;
		working: boolean;
	}

	interface MarkdownView {
		syncState(this: MarkdownView, sameType: boolean): Promise<boolean>;
		getScrollOffsetForSync(this: MarkdownView, group: string): number;
		[MarkdownViewScrollOffset]: number | undefined;
		[MarkdownViewScrollGroup]: string | undefined;
	}
}

export default class MarkdownSyncScrollPlugin extends Plugin {
	originalSyncState: MarkdownView['syncState'];

	async onload() {
		this.originalSyncState = MarkdownView.prototype.syncState;
        MarkdownView.prototype.getScrollOffsetForSync = function(group) {
            let scrollOffset = this[MarkdownViewScrollOffset];
            if (group !== this[MarkdownViewScrollGroup]) {
                scrollOffset = undefined;
            }
            if (scrollOffset === undefined) {
                const currentScroll = this.currentMode.getScroll();
                this[MarkdownViewScrollOffset] = currentScroll;
                this[MarkdownViewScrollGroup] = group;
				return currentScroll;
            }
            return scrollOffset;
        }
        MarkdownView.prototype.syncState = async function(sameType) {
            const leaf = this.leaf as unknown as WorkspaceLeaf;
            const group = leaf.group;
            if (!group) return false;
            // Build OpenViewState from current view state (replacing removed getSyncViewState method)
            const syncViewState: OpenViewState = {
                state: this.getState(),
                eState: this.getEphemeralState()
            };
            const currentScroll = this.currentMode.getScroll();
            const srcScrollOffset = this.getScrollOffsetForSync(group);
            let success = true;
            for (const groupLeaf of leaf.workspace.getGroupLeaves(group)) {
                if (groupLeaf === leaf) continue;
                const isSameType = groupLeaf.view.getViewType() === this.getViewType();
                if (!sameType || isSameType) {
                    if (groupLeaf.working) {
                        success = false;
                        continue;
                    }
                    const destView = groupLeaf.view;
                    if (destView instanceof MarkdownView) {
                        const destScrollOffset = destView.getScrollOffsetForSync(group);
                        destView.currentMode.applyScroll(currentScroll - srcScrollOffset + destScrollOffset);
                    } else {
                        await groupLeaf.openFile(this.file, syncViewState);
                    }
                }
            }
            return success;
        }
	}

	onunload() {
		MarkdownView.prototype.syncState = this.originalSyncState;
	}
}
