import type { FC } from 'hono/jsx';
import type { Folder } from '../types';

interface FolderTreeProps {
  folders: Folder[];
  selectedFolderId: number | null;
  canEdit: boolean;
}

interface FolderNodeProps {
  folder: Folder;
  folders: Folder[];
  level: number;
  selectedFolderId: number | null;
  canEdit: boolean;
}

const FolderNode: FC<FolderNodeProps> = ({ folder, folders, level, selectedFolderId, canEdit }) => {
  const children = folders.filter(f => f.parentId === folder.id);
  const isSelected = selectedFolderId === folder.id;
  const hasChildren = children.length > 0;
  
  return (
    <div x-data="{ expanded: true }">
      <div
        class={`group flex items-center gap-1 py-1.5 rounded-lg cursor-pointer transition-colors ${
          isSelected 
            ? 'bg-primary-100 text-primary-800' 
            : 'hover:bg-neutral-100 text-neutral-700'
        }`}
        style={`padding-left: ${8 + level * 20}px; padding-right: 8px;`}
      >
        {/* Expand/Collapse Toggle */}
        {hasChildren ? (
          <button
            type="button"
            class="p-0.5 hover:bg-neutral-200 rounded transition-colors flex-shrink-0"
            x-on:click="expanded = !expanded"
          >
            <svg 
              class="w-4 h-4 transition-transform" 
              x-bind:class="expanded ? 'rotate-90' : ''"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span class="w-5 flex-shrink-0"></span>
        )}
        
        {/* Folder Link */}
        <a
          href={`/test-plan?folderId=${folder.id}`}
          class="flex items-center gap-2 flex-1 min-w-0"
        >
          <svg class="w-5 h-5 text-warning-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <span class="text-sm font-medium truncate">{folder.name}</span>
        </a>
        
        {/* Edit Actions */}
        {canEdit && (
          <div class="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
            <button
              type="button"
              class="p-1 hover:bg-neutral-200 rounded text-neutral-500 hover:text-neutral-700"
              title="Add subfolder"
              x-on:click={`window.dispatchEvent(new CustomEvent('open-folder-modal', { detail: { parentId: ${folder.id}, name: '', isEdit: false } }))`}
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              type="button"
              class="p-1 hover:bg-neutral-200 rounded text-neutral-500 hover:text-neutral-700"
              title="Edit folder"
              x-on:click={`window.dispatchEvent(new CustomEvent('open-folder-modal', { detail: { id: ${folder.id}, parentId: ${folder.parentId || 'null'}, name: '${folder.name.replace(/'/g, "\\'")}', isEdit: true } }))`}
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              type="button"
              class="p-1 hover:bg-danger-100 rounded text-neutral-500 hover:text-danger-600"
              title="Delete folder"
              x-on:click={`if(confirm('Delete this folder?')) { fetch('/api/folders/${folder.id}', { method: 'DELETE' }).then(() => window.location.reload()) }`}
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>
      
      {/* Children */}
      {hasChildren && (
        <div x-show="expanded" x-collapse class="ml-0">
          {children.map(child => (
            <FolderNode
              key={child.id}
              folder={child}
              folders={folders}
              level={level + 1}
              selectedFolderId={selectedFolderId}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FolderTree: FC<FolderTreeProps> = ({ folders, selectedFolderId, canEdit }) => {
  const rootFolders = folders.filter(f => f.parentId === null);
  const hasAnyFolders = folders.length > 0;
  
  return (
    <div 
      id="folder-tree" 
      class="space-y-1"
      x-data={`{
        allExpanded: true,
        toggleAll() {
          this.allExpanded = !this.allExpanded;
          document.querySelectorAll('[x-data*="expanded"]').forEach(el => {
            if (el._x_dataStack) {
              el._x_dataStack[0].expanded = this.allExpanded;
            }
          });
        }
      }`}
    >
      {/* Expand/Collapse All Toggle */}
      {hasAnyFolders && (
        <button
          type="button"
          class="flex items-center gap-2 px-3 py-1.5 w-full text-left text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
          x-on:click="toggleAll()"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="flex-shrink-0">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          <span x-text="allExpanded ? 'Collapse All' : 'Expand All'">Collapse All</span>
        </button>
      )}
      
      {/* All Test Cases option */}
      <a
        href="/test-plan"
        class={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
          selectedFolderId === null 
            ? 'bg-primary-100 text-primary-800' 
            : 'hover:bg-neutral-100 text-neutral-700'
        }`}
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <span class="text-sm font-medium">All Test Cases</span>
      </a>
      
      {/* Folder Tree */}
      {rootFolders.map(folder => (
        <FolderNode
          key={folder.id}
          folder={folder}
          folders={folders}
          level={0}
          selectedFolderId={selectedFolderId}
          canEdit={canEdit}
        />
      ))}
      
      {/* Add Root Folder Button */}
      {canEdit && (
        <button
          type="button"
          class="flex items-center gap-2 px-3 py-2 w-full text-left text-sm text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors mt-2"
          x-on:click="window.dispatchEvent(new CustomEvent('open-folder-modal', { detail: { parentId: null, name: '', isEdit: false } }))"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          New Folder
        </button>
      )}
    </div>
  );
};

