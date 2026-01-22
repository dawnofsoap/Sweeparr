import { useState, useEffect } from 'react';
import { collections, rules } from '../api';
import type { Collection, CollectionItem, Rule } from '../api/types';
import { LoadingPage } from '../components/LoadingSpinner';

function Collections() {
  const [collectionsList, setCollectionsList] = useState<Collection[]>([]);
  const [rulesList, setRulesList] = useState<Rule[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchCollections = async () => {
    setLoading(true);
    try {
      const [collectionsRes, rulesRes] = await Promise.all([
        collections.list(),
        rules.list(),
      ]);
      setCollectionsList(collectionsRes.data);
      setRulesList(rulesRes.data);
    } catch (error) {
      console.error('Failed to fetch collections:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCollectionDetails = async (id: number) => {
    try {
      const res = await collections.get(id);
      setSelectedCollection(res.data);
    } catch (error) {
      console.error('Failed to fetch collection details:', error);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  const handleCreateCollection = async (data: { name: string; description?: string; isExclusion: boolean }) => {
    try {
      await collections.create(data);
      setShowCreateModal(false);
      fetchCollections();
    } catch (error) {
      console.error('Failed to create collection:', error);
    }
  };

  const handleDeleteCollection = async (id: number) => {
    if (!confirm('Are you sure you want to delete this collection? Items will not be deleted.')) return;
    try {
      await collections.delete(id);
      setSelectedCollection(null);
      fetchCollections();
    } catch (error) {
      console.error('Failed to delete collection:', error);
    }
  };

  const handleExcludeItem = async (collectionId: number, itemId: number) => {
    try {
      await collections.excludeItem(collectionId, itemId);
      fetchCollectionDetails(collectionId);
    } catch (error) {
      console.error('Failed to exclude item:', error);
    }
  };

  const handleRemoveItem = async (collectionId: number, itemId: number) => {
    try {
      await collections.removeItem(collectionId, itemId);
      fetchCollectionDetails(collectionId);
      fetchCollections();
    } catch (error) {
      console.error('Failed to remove item:', error);
    }
  };

  if (loading) {
    return <LoadingPage />;
  }

  // Separate rule-based collections from exclusion lists
  const ruleCollections = collectionsList.filter(c => !c.isExclusion);
  const exclusionLists = collectionsList.filter(c => c.isExclusion);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Collections</h1>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          + New Exclusion List
        </button>
      </div>

      <p className="text-secondary">
        Collections show media that matches your rules and is scheduled for cleanup.
        Items appear here during their grace period before action is taken.
        You can also create exclusion lists to protect specific items.
      </p>

      {collectionsList.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-secondary">
            <svg
              className="w-16 h-16 mx-auto mb-4 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <p className="text-lg">No collections yet</p>
            <p className="text-sm mt-2">
              Collections will appear here when rules match media items.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Collection List */}
          <div className="space-y-6">
            {/* Rule Collections */}
            {ruleCollections.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
                  Rule Collections
                </h3>
                <div className="space-y-2">
                  {ruleCollections.map((collection) => (
                    <CollectionCard
                      key={collection.id}
                      collection={collection}
                      isSelected={selectedCollection?.id === collection.id}
                      onClick={() => fetchCollectionDetails(collection.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Exclusion Lists */}
            {exclusionLists.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
                  Exclusion Lists
                </h3>
                <div className="space-y-2">
                  {exclusionLists.map((collection) => (
                    <CollectionCard
                      key={collection.id}
                      collection={collection}
                      isSelected={selectedCollection?.id === collection.id}
                      onClick={() => fetchCollectionDetails(collection.id)}
                      isExclusion
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state for categories */}
            {ruleCollections.length === 0 && (
              <div className="card p-4 text-center text-muted text-sm">
                No rule collections yet. Create rules with grace periods to see matched items here.
              </div>
            )}
          </div>

          {/* Collection Details */}
          <div className="lg:col-span-2">
            {selectedCollection ? (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold">
                        {selectedCollection.name}
                      </h2>
                      {selectedCollection.isExclusion && (
                        <span className="px-2 py-0.5 bg-yellow-900/50 text-yellow-300 text-xs rounded">
                          Exclusion List
                        </span>
                      )}
                    </div>
                    {selectedCollection.description && (
                      <p className="text-secondary mt-1">
                        {selectedCollection.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedCollection.isExclusion && (
                      <button className="btn btn-secondary text-sm">
                        + Add Item
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteCollection(selectedCollection.id)}
                      className="btn btn-danger text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-tertiary rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{selectedCollection.items?.length || 0}</p>
                    <p className="text-xs text-muted">Total Items</p>
                  </div>
                  <div className="bg-tertiary rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-400">
                      {selectedCollection.items?.filter(i => i.isExcluded).length || 0}
                    </p>
                    <p className="text-xs text-muted">Excluded</p>
                  </div>
                  <div className="bg-tertiary rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-400">
                      {selectedCollection.items?.filter(i => {
                        const days = Math.ceil((new Date(i.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        return days <= 7 && !i.isExcluded;
                      }).length || 0}
                    </p>
                    <p className="text-xs text-muted">Expiring Soon</p>
                  </div>
                </div>

                {selectedCollection.items && selectedCollection.items.length > 0 ? (
                  <div className="space-y-3">
                    {selectedCollection.items.map((item) => (
                      <CollectionItemCard
                        key={item.id}
                        item={item}
                        onExclude={() =>
                          handleExcludeItem(selectedCollection.id, item.id)
                        }
                        onRemove={() =>
                          handleRemoveItem(selectedCollection.id, item.id)
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-muted text-center py-8 bg-tertiary rounded-lg">
                    No items in this collection.
                  </div>
                )}
              </div>
            ) : (
              <div className="card p-8 text-center text-secondary">
                <svg
                  className="w-12 h-12 mx-auto mb-4 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
                <p>Select a collection to view its items</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Exclusion List Modal */}
      {showCreateModal && (
        <CreateCollectionModal
          onSave={handleCreateCollection}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}

interface CollectionCardProps {
  collection: Collection;
  isSelected: boolean;
  onClick: () => void;
  isExclusion?: boolean;
}

function CollectionCard({ collection, isSelected, onClick, isExclusion }: CollectionCardProps) {
  return (
    <div
      onClick={onClick}
      className={`card p-4 cursor-pointer transition-all ${
        isSelected
          ? 'ring-2 ring-orange-500'
          : 'hover:border-orange-500/50'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium truncate">{collection.name}</h3>
          <p className="text-sm text-muted">
            {collection._count?.items || 0} items
          </p>
        </div>
        <div className="flex items-center gap-2 ml-2">
          {isExclusion && (
            <span className="text-yellow-400 text-xs">🛡</span>
          )}
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${
              collection.isActive ? 'bg-green-500' : 'bg-gray-500'
            }`}
          />
        </div>
      </div>
    </div>
  );
}

interface CollectionItemCardProps {
  item: CollectionItem;
  onExclude: () => void;
  onRemove: () => void;
}

function CollectionItemCard({ item, onExclude, onRemove }: CollectionItemCardProps) {
  const daysUntilExpiry = item.expiresAt 
    ? Math.ceil((new Date(item.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div
      className={`p-4 list-item-bg rounded-lg ${
        item.isExcluded ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <h4 className="font-medium truncate">{item.title}</h4>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted">
            <span className="capitalize">{item.mediaType}</span>
            <span>
              {item.isExcluded ? (
                <span className="text-yellow-400">Excluded from cleanup</span>
              ) : daysUntilExpiry !== null ? (
                daysUntilExpiry > 0 ? (
                  <span>
                    Expires in{' '}
                    <span
                      className={
                        daysUntilExpiry <= 7 ? 'text-red-400 font-medium' : 'text-secondary'
                      }
                    >
                      {daysUntilExpiry} days
                    </span>
                  </span>
                ) : (
                  <span className="text-red-400 font-medium">Expired - pending action</span>
                )
              ) : (
                <span className="text-secondary">No expiry</span>
              )}
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Added {new Date(item.addedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          {!item.isExcluded && (
            <button
              onClick={onExclude}
              className="btn btn-secondary text-sm"
              title="Exclude from cleanup"
            >
              Exclude
            </button>
          )}
          <button onClick={onRemove} className="btn btn-danger text-sm">
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

interface CreateCollectionModalProps {
  onSave: (data: { name: string; description?: string; isExclusion: boolean }) => void;
  onClose: () => void;
}

function CreateCollectionModal({ onSave, onClose }: CreateCollectionModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        isExclusion: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative card rounded-lg shadow-xl w-full max-w-md p-6 m-4">
        <h2 className="text-xl font-semibold mb-4">Create Exclusion List</h2>
        
        <p className="text-sm text-secondary mb-4">
          Exclusion lists protect specific media from being cleaned up by rules.
          Add items manually to keep them safe.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label block mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
              placeholder="e.g., Favorites, Kids Movies"
              autoFocus
            />
          </div>
          
          <div>
            <label className="form-label block mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input w-full"
              placeholder="Optional description"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={saving || !name.trim()} 
              className="btn btn-primary"
            >
              {saving ? 'Creating...' : 'Create List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Collections;
