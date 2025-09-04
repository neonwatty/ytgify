import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { bulkOperations, type BulkOperationResult } from './bulk-operations';
import type { GifMetadata } from '@/types/storage';

interface ManagementToolsProps {
  selectedGifs: string[];
  allGifs: GifMetadata[];
  onSelectionChange: (ids: string[]) => void;
  onRefresh: () => void;
  className?: string;
}

export const ManagementTools: React.FC<ManagementToolsProps> = ({
  selectedGifs,
  allGifs,
  onSelectionChange,
  onRefresh,
  className = ''
}) => {
  // Dialogs state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);

  // Operation state
  const [isProcessing, setIsProcessing] = useState(false);
  const [, setOperationResult] = useState<BulkOperationResult | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  // Tag management state
  const [tagsToAdd, setTagsToAdd] = useState('');
  const [tagsToRemove, setTagsToRemove] = useState('');
  const [tagOperation, setTagOperation] = useState<'add' | 'remove'>('add');

  // Edit state
  const [editingGif, setEditingGif] = useState<GifMetadata | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTags, setEditTags] = useState('');

  // Export/Import state
  const [exportOptions, setExportOptions] = useState({
    includeBlobs: false,
    format: 'json' as 'json' | 'zip'
  });
  const [importFile, setImportFile] = useState<File | null>(null);

  // Statistics state
  const [libraryStats, setLibraryStats] = useState<{
    totalGifs: number;
    totalSize: number;
    averageSize: number;
    totalDuration: number;
    averageDuration: number;
    uniqueTags: number;
    mostUsedTags: Array<{ tag: string; count: number }>;
  } | null>(null);

  // Check undo availability
  useEffect(() => {
    setCanUndo(bulkOperations.canUndo());
  }, [selectedGifs]);

  // Handle bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (selectedGifs.length === 0) return;

    setIsProcessing(true);
    setShowDeleteDialog(false);

    try {
      const result = await bulkOperations.deleteMultiple(selectedGifs);
      setOperationResult(result);
      
      if (result.success > 0) {
        onRefresh();
        onSelectionChange([]);
        setCanUndo(true);
      }

      // Show result notification
      if (result.failed > 0) {
        alert(`Deleted ${result.success} GIFs. Failed to delete ${result.failed} GIFs.`);
      } else {
        alert(`Successfully deleted ${result.success} GIFs.`);
      }
    } catch (error) {
      console.error('Bulk delete failed:', error);
      alert('Failed to delete GIFs. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedGifs, onRefresh, onSelectionChange]);

  // Handle tag operations
  const handleTagOperation = useCallback(async () => {
    if (selectedGifs.length === 0) return;

    setIsProcessing(true);
    setShowTagDialog(false);

    const tags = (tagOperation === 'add' ? tagsToAdd : tagsToRemove)
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (tags.length === 0) {
      alert('Please enter at least one tag.');
      setIsProcessing(false);
      return;
    }

    try {
      const result = tagOperation === 'add'
        ? await bulkOperations.addTagsToMultiple(selectedGifs, tags)
        : await bulkOperations.removeTagsFromMultiple(selectedGifs, tags);

      setOperationResult(result);
      
      if (result.success > 0) {
        onRefresh();
        setCanUndo(true);
      }

      // Show result notification
      if (result.failed > 0) {
        alert(`Updated ${result.success} GIFs. Failed to update ${result.failed} GIFs.`);
      } else {
        alert(`Successfully updated ${result.success} GIFs.`);
      }

      // Reset state
      setTagsToAdd('');
      setTagsToRemove('');
    } catch (error) {
      console.error('Tag operation failed:', error);
      alert('Failed to update tags. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedGifs, tagOperation, tagsToAdd, tagsToRemove, onRefresh]);

  // Handle single GIF edit
  const handleEditGif = useCallback(async () => {
    if (!editingGif) return;

    setIsProcessing(true);
    setShowEditDialog(false);

    try {
      await bulkOperations.editGifMetadata(editingGif.id, {
        title: editTitle,
        description: editDescription,
        tags: editTags.split(',').map(t => t.trim()).filter(t => t.length > 0)
      });

      onRefresh();
      setCanUndo(true);
      alert('GIF updated successfully.');
    } catch (error) {
      console.error('Edit failed:', error);
      alert('Failed to update GIF. Please try again.');
    } finally {
      setIsProcessing(false);
      setEditingGif(null);
    }
  }, [editingGif, editTitle, editDescription, editTags, onRefresh]);

  // Handle export
  const handleExport = useCallback(async () => {
    setIsProcessing(true);
    setShowExportDialog(false);

    try {
      let exportData: Blob;
      let filename: string;

      if (exportOptions.format === 'zip') {
        exportData = await bulkOperations.exportToZip({
          includeBlobs: exportOptions.includeBlobs,
          selectedIds: selectedGifs
        });
        filename = `gif-library-${new Date().toISOString().split('T')[0]}.zip`;
      } else {
        const jsonData = await bulkOperations.exportToJSON({
          includeBlobs: exportOptions.includeBlobs,
          selectedIds: selectedGifs
        });
        exportData = new Blob([jsonData], { type: 'application/json' });
        filename = `gif-library-${new Date().toISOString().split('T')[0]}.json`;
      }

      // Download file
      const url = URL.createObjectURL(exportData);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert('Export completed successfully.');
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export GIFs. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [exportOptions, selectedGifs]);

  // Handle import
  const handleImport = useCallback(async () => {
    if (!importFile) {
      alert('Please select a file to import.');
      return;
    }

    setIsProcessing(true);
    setShowImportDialog(false);

    try {
      const fileContent = await importFile.text();
      const result = await bulkOperations.importFromJSON(fileContent);

      if (result.imported > 0) {
        onRefresh();
      }

      let message = `Imported ${result.imported} GIFs.`;
      if (result.skipped > 0) {
        message += ` Skipped ${result.skipped} existing GIFs.`;
      }
      if (result.errors.length > 0) {
        message += `\n\nErrors:\n${result.errors.join('\n')}`;
      }

      alert(message);
    } catch (error) {
      console.error('Import failed:', error);
      alert('Failed to import GIFs. Please check the file format and try again.');
    } finally {
      setIsProcessing(false);
      setImportFile(null);
    }
  }, [importFile, onRefresh]);

  // Handle undo
  const handleUndo = useCallback(async () => {
    setIsProcessing(true);

    try {
      const success = await bulkOperations.undo();
      if (success) {
        onRefresh();
        setCanUndo(bulkOperations.canUndo());
        alert('Operation undone successfully.');
      } else {
        alert('Failed to undo operation.');
      }
    } catch (error) {
      console.error('Undo failed:', error);
      alert('Failed to undo operation.');
    } finally {
      setIsProcessing(false);
    }
  }, [onRefresh]);

  // Load library statistics
  const loadStatistics = useCallback(async () => {
    try {
      const stats = await bulkOperations.getLibraryStats();
      setLibraryStats(stats);
      setShowStatsDialog(true);
    } catch (error) {
      console.error('Failed to load statistics:', error);
      alert('Failed to load library statistics.');
    }
  }, []);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    onSelectionChange(allGifs.map(g => g.id));
  }, [allGifs, onSelectionChange]);

  // Handle clear selection
  const handleClearSelection = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  // Open edit dialog for single GIF - currently unused but may be needed in future
  // const openEditDialog = useCallback((gif: GifMetadata) => {
  //   setEditingGif(gif);
  //   setEditTitle(gif.title || '');
  //   setEditDescription(gif.description || '');
  //   setEditTags(gif.tags.join(', '));
  //   setShowEditDialog(true);
  // }, []);

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toFixed(1).padStart(4, '0')}`;
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Selection controls */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{selectedGifs.length} selected</span>
        {selectedGifs.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearSelection}
          >
            Clear
          </Button>
        )}
        {selectedGifs.length < allGifs.length && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSelectAll}
          >
            Select All
          </Button>
        )}
      </div>

      <div className="flex-1" />

      {/* Bulk operations */}
      {selectedGifs.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={isProcessing}>
              Bulk Actions ({selectedGifs.length})
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowDeleteDialog(true)}>
              Delete Selected
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              setTagOperation('add');
              setShowTagDialog(true);
            }}>
              Add Tags
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              setTagOperation('remove');
              setShowTagDialog(true);
            }}>
              Remove Tags
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowExportDialog(true)}>
              Export Selected
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Library management */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={isProcessing}>
            Library
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowExportDialog(true)}>
            Export All
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowImportDialog(true)}>
            Import
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={loadStatistics}>
            Statistics
          </DropdownMenuItem>
          {canUndo && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleUndo}>
                Undo Last Action
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedGifs.length} GIFs?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone directly, but you can use the Undo feature immediately after deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tag management dialog */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {tagOperation === 'add' ? 'Add Tags' : 'Remove Tags'}
            </DialogTitle>
            <DialogDescription>
              {tagOperation === 'add'
                ? `Add tags to ${selectedGifs.length} selected GIFs.`
                : `Remove tags from ${selectedGifs.length} selected GIFs.`}
              Separate multiple tags with commas.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="tag1, tag2, tag3..."
            value={tagOperation === 'add' ? tagsToAdd : tagsToRemove}
            onChange={(e) => 
              tagOperation === 'add'
                ? setTagsToAdd(e.target.value)
                : setTagsToRemove(e.target.value)
            }
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTagDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleTagOperation}>
              {tagOperation === 'add' ? 'Add Tags' : 'Remove Tags'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit GIF</DialogTitle>
            <DialogDescription>
              Update the metadata for this GIF.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="GIF title"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="GIF description"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Tags (comma-separated)</label>
              <Input
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="tag1, tag2, tag3..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditGif}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export GIFs</DialogTitle>
            <DialogDescription>
              Export {selectedGifs.length > 0 ? `${selectedGifs.length} selected` : 'all'} GIFs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={exportOptions.includeBlobs}
                onChange={(e) => setExportOptions({
                  ...exportOptions,
                  includeBlobs: e.target.checked
                })}
              />
              Include GIF data (larger file size)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport}>Export</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import GIFs</DialogTitle>
            <DialogDescription>
              Import GIFs from a previously exported JSON file.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="file"
            accept=".json"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!importFile}>
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Statistics dialog */}
      <Dialog open={showStatsDialog} onOpenChange={setShowStatsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Library Statistics</DialogTitle>
          </DialogHeader>
          {libraryStats && (
            <div className="space-y-2 text-sm">
              <div>Total GIFs: {libraryStats.totalGifs}</div>
              <div>Total Size: {formatFileSize(libraryStats.totalSize)}</div>
              <div>Average Size: {formatFileSize(libraryStats.averageSize)}</div>
              <div>Total Duration: {formatDuration(libraryStats.totalDuration)}</div>
              <div>Average Duration: {formatDuration(libraryStats.averageDuration)}</div>
              <div>Unique Tags: {libraryStats.uniqueTags}</div>
              {libraryStats.mostUsedTags.length > 0 && (
                <div>
                  <div className="font-medium mt-4">Most Used Tags:</div>
                  {libraryStats.mostUsedTags.map((tag) => (
                    <div key={tag.tag}>
                      {tag.tag} ({tag.count} uses)
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowStatsDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagementTools;