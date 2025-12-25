import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import notesService from '../../services/notesService';
import './Notes.css';

export default function Notes() {
  const queryClient = useQueryClient();
  const editorRef = useRef<HTMLDivElement>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUserTypingRef = useRef<boolean>(false);
  const lastCategoryIdRef = useRef<number | null>(null);

  // Fetch categories
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['notesCategories'],
    queryFn: () => notesService.getCategories(),
    select: (data) => data.categories || []
  });

  const categories = categoriesData || [];

  // Set default category when categories load
  useEffect(() => {
    if (categories.length > 0 && selectedCategoryId === null) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  // Load notes when category changes
  const { data: notesData, isLoading: notesLoading } = useQuery({
    queryKey: ['notes', selectedCategoryId],
    queryFn: () => {
      if (!selectedCategoryId) throw new Error('No category selected');
      return notesService.loadNotes(selectedCategoryId);
    },
    enabled: !!selectedCategoryId,
    select: (data) => data.notes || '',
    // Don't refetch on window focus to prevent clearing
    refetchOnWindowFocus: false,
    // Keep stale data while refetching
    staleTime: 0
  });

  // Update editor content when notes load (only if category changed or not typing)
  useEffect(() => {
    if (selectedCategoryId && editorRef.current) {
      // If category changed, always update editor with new notes
      if (lastCategoryIdRef.current !== selectedCategoryId) {
        // Category changed - wait for notes to load completely
        // Only update when loading is done AND we have data
        if (!notesLoading && notesData !== undefined) {
          // Update editor with new category's notes
          editorRef.current.innerHTML = notesData;
          setEditorContent(notesData);
          lastCategoryIdRef.current = selectedCategoryId;
          isUserTypingRef.current = false;
        }
        // If still loading, don't touch editor - keep previous content visible
      } else if (lastCategoryIdRef.current === selectedCategoryId && !notesLoading && notesData !== undefined && !isUserTypingRef.current) {
        // Same category, but notes updated from server (e.g., after save)
        // Only update if user is not actively typing
        const currentContent = editorRef.current.innerHTML;
        // Only update if content is different (to avoid unnecessary updates)
        if (currentContent !== notesData) {
          editorRef.current.innerHTML = notesData;
          setEditorContent(notesData);
        }
      }
    }
  }, [notesData, selectedCategoryId, notesLoading]);

  // Save notes mutation
  const saveNotesMutation = useMutation({
    mutationFn: ({ content, categoryId }: { content: string; categoryId: number }) =>
      notesService.saveNotes(content, categoryId),
    onSuccess: (_, variables) => {
      setSaveStatus('saved');
      // Invalidate query cache to refresh notes when navigating back
      queryClient.invalidateQueries({ queryKey: ['notes', variables.categoryId] });
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    },
    onError: () => {
      setSaveStatus('error');
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    }
  });

  // Manual save function
  const handleManualSave = useCallback(() => {
    if (!editorRef.current || !selectedCategoryId) return;
    
    const content = editorRef.current.innerHTML;
    saveNotesMutation.mutate({
      content,
      categoryId: selectedCategoryId
    });
  }, [selectedCategoryId, saveNotesMutation]);

  // Auto-save handler
  const handleEditorChange = useCallback(() => {
    if (!editorRef.current || !selectedCategoryId) return;

    isUserTypingRef.current = true;
    const content = editorRef.current.innerHTML;
    setEditorContent(content);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set saving status
    setSaveStatus('saving');

    // Auto-save after 1 second of inactivity
    saveTimeoutRef.current = setTimeout(() => {
      saveNotesMutation.mutate({
        content,
        categoryId: selectedCategoryId
      });
      isUserTypingRef.current = false;
    }, 1000);
  }, [selectedCategoryId, saveNotesMutation]);

  // Save on blur (when user clicks away from editor)
  const handleEditorBlur = useCallback(() => {
    if (!editorRef.current || !selectedCategoryId) return;
    
    const content = editorRef.current.innerHTML;
    // Only save if content changed
    if (content !== editorContent) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveNotesMutation.mutate({
        content,
        categoryId: selectedCategoryId
      });
    }
    isUserTypingRef.current = false;
  }, [selectedCategoryId, editorContent, saveNotesMutation]);

  // Save before unmount or category change
  useEffect(() => {
    return () => {
      // Save on unmount
      if (editorRef.current && selectedCategoryId && isUserTypingRef.current) {
        const content = editorRef.current.innerHTML;
        if (content && content !== editorContent) {
          notesService.saveNotes(content, selectedCategoryId).catch(() => {
            // Silent fail on unmount
          });
        }
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [selectedCategoryId, editorContent]);

  // Add category mutation
  const addCategoryMutation = useMutation({
    mutationFn: (name: string) => notesService.addCategory(name),
    onSuccess: (data) => {
      if (data.success && data.category) {
        queryClient.invalidateQueries({ queryKey: ['notesCategories'] });
        setSelectedCategoryId(data.category.id);
        setShowAddCategoryModal(false);
        setNewCategoryName('');
        Swal.fire('Success', 'Category added successfully', 'success');
      } else {
        Swal.fire('Error', data.message || 'Failed to add category', 'error');
      }
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to add category', 'error');
    }
  });

  const handleAddCategory = () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      Swal.fire('Error', 'Please enter a category name', 'error');
      return;
    }
    addCategoryMutation.mutate(trimmedName);
  };

  // Formatting functions
  const formatText = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleEditorChange();
  };

  const getStatusText = () => {
    switch (saveStatus) {
      case 'saving':
        return 'Saving...';
      case 'saved':
        return 'Saved';
      case 'error':
        return 'Error saving';
      default:
        return 'Start typing...';
    }
  };

  const getStatusClass = () => {
    switch (saveStatus) {
      case 'saving':
        return 'status-saving';
      case 'saved':
        return 'status-saved';
      case 'error':
        return 'status-error';
      default:
        return '';
    }
  };

  return (
    <div className="notes-container">
      <div className="notes-header">
        <div className="notes-header-content">
          <h1 className="notes-title">
            <i className="fa fa-sticky-note"></i> Notes
          </h1>
          <div className="header-actions">
            <button
              className="btn-save-now"
              onClick={handleManualSave}
              disabled={saveNotesMutation.isPending || !selectedCategoryId}
              title="Save Now"
            >
              <i className="fa fa-save"></i> Save Now
            </button>
            <div className={`save-status ${getStatusClass()}`}>
              <i className={`fa ${saveStatus === 'saved' ? 'fa-check-circle' : saveStatus === 'saving' ? 'fa-spinner fa-spin' : saveStatus === 'error' ? 'fa-exclamation-circle' : 'fa-circle'}`}></i>
              {getStatusText()}
            </div>
          </div>
        </div>
      </div>

      <div className="notes-layout">
        {/* Sidebar */}
        <div className="notes-sidebar">
          <div className="sidebar-header">
            <h3>Categories</h3>
            <button
              className="btn-add-category"
              onClick={() => setShowAddCategoryModal(true)}
              title="Add Category"
            >
              <i className="fa fa-plus"></i>
            </button>
          </div>
          
          <div className="categories-list">
            {categoriesLoading ? (
              <div className="loading-state">
                <i className="fa fa-spinner fa-spin"></i> Loading categories...
              </div>
            ) : categories.length === 0 ? (
              <div className="empty-state">
                <i className="fa fa-folder-open"></i>
                <p>No categories yet</p>
                <button
                  className="btn-primary-small"
                  onClick={() => setShowAddCategoryModal(true)}
                >
                  Create Category
                </button>
              </div>
            ) : (
              categories.map((category) => (
                <div
                  key={category.id}
                  className={`category-item ${selectedCategoryId === category.id ? 'active' : ''}`}
                  onClick={async () => {
                    if (category.id === selectedCategoryId) return; // Already selected
                    
                    // Save current content before switching
                    if (editorRef.current && selectedCategoryId) {
                      const currentContent = editorRef.current.innerHTML;
                      if (currentContent.trim() !== '') {
                        // Save current category's content before switching
                        try {
                          await notesService.saveNotes(currentContent, selectedCategoryId);
                          // Invalidate cache for old category
                          queryClient.invalidateQueries({ queryKey: ['notes', selectedCategoryId] });
                        } catch (error) {
                          // Silent fail - continue with switch
                        }
                      }
                    }
                    // Clear typing flag and update category
                    isUserTypingRef.current = false;
                    // Reset last category ref so useEffect knows category changed
                    lastCategoryIdRef.current = selectedCategoryId;
                    setSelectedCategoryId(category.id);
                  }}
                >
                  <i className="fa fa-folder"></i>
                  <span>{category.name}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="notes-editor-area">
          {!selectedCategoryId ? (
            <div className="empty-editor-state">
              <i className="fa fa-sticky-note"></i>
              <h3>Select a category to start</h3>
              <p>Choose a category from the sidebar or create a new one</p>
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="editor-toolbar">
                <div className="toolbar-group">
                  <button
                    className="toolbar-btn"
                    onClick={() => formatText('bold')}
                    title="Bold"
                  >
                    <i className="fa fa-bold"></i>
                  </button>
                  <button
                    className="toolbar-btn"
                    onClick={() => formatText('italic')}
                    title="Italic"
                  >
                    <i className="fa fa-italic"></i>
                  </button>
                  <button
                    className="toolbar-btn"
                    onClick={() => formatText('underline')}
                    title="Underline"
                  >
                    <i className="fa fa-underline"></i>
                  </button>
                </div>

                <div className="toolbar-divider"></div>

                <div className="toolbar-group">
                  <button
                    className="toolbar-btn"
                    onClick={() => formatText('justifyLeft')}
                    title="Align Left"
                  >
                    <i className="fa fa-align-left"></i>
                  </button>
                  <button
                    className="toolbar-btn"
                    onClick={() => formatText('justifyCenter')}
                    title="Align Center"
                  >
                    <i className="fa fa-align-center"></i>
                  </button>
                  <button
                    className="toolbar-btn"
                    onClick={() => formatText('justifyRight')}
                    title="Align Right"
                  >
                    <i className="fa fa-align-right"></i>
                  </button>
                </div>

                <div className="toolbar-divider"></div>

                <div className="toolbar-group">
                  <button
                    className="toolbar-btn"
                    onClick={() => formatText('insertUnorderedList')}
                    title="Bullet List"
                  >
                    <i className="fa fa-list-ul"></i>
                  </button>
                  <button
                    className="toolbar-btn"
                    onClick={() => formatText('insertOrderedList')}
                    title="Numbered List"
                  >
                    <i className="fa fa-list-ol"></i>
                  </button>
                </div>

                <div className="toolbar-divider"></div>

                <div className="toolbar-group">
                  <button
                    className="toolbar-btn"
                    onClick={() => formatText('removeFormat')}
                    title="Clear Formatting"
                  >
                    <i className="fa fa-remove-format"></i>
                  </button>
                </div>
              </div>

              {/* Editor */}
              <div className="editor-wrapper">
                <div
                  ref={editorRef}
                  className={`notes-editor ${notesLoading ? 'loading' : ''}`}
                  contentEditable={!notesLoading}
                  onInput={handleEditorChange}
                  onBlur={handleEditorBlur}
                  onPaste={(e) => {
                    e.preventDefault();
                    const text = e.clipboardData.getData('text/plain');
                    document.execCommand('insertText', false, text);
                    handleEditorChange();
                  }}
                  placeholder="Start typing your notes here..."
                />
                {notesLoading && (
                  <div className="editor-loading-overlay">
                    <i className="fa fa-spinner fa-spin"></i> Loading notes...
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <div className="modal-overlay" onClick={() => setShowAddCategoryModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Category</h3>
              <button
                className="modal-close"
                onClick={() => setShowAddCategoryModal(false)}
              >
                <i className="fa fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                className="form-input"
                placeholder="Category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddCategory();
                  }
                }}
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowAddCategoryModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleAddCategory}
                disabled={addCategoryMutation.isPending}
              >
                {addCategoryMutation.isPending ? 'Adding...' : 'Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

