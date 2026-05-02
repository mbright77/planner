import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useBootstrap } from '../../processes/family-bootstrap/useBootstrap';
import {
  useCreateShoppingItem,
  useDeleteShoppingItem,
  useShoppingItems,
  useUpdateShoppingItem,
} from '../../entities/shopping-item/model/useShoppingItems';

const defaultCategories = ['Produce', 'Dairy', 'Pantry', 'Household'];

function getProfileColorChipClass(colorKey: string | null | undefined) {
  return colorKey ? `profile-color-chip profile-color-chip-${colorKey}` : 'profile-color-chip';
}

function getCategoryIcon(category: string) {
  const normalized = category.toLowerCase();

  if (normalized.includes('produce')) return 'local_florist';
  if (normalized.includes('dairy')) return 'egg_alt';
  if (normalized.includes('pantry')) return 'kitchen';
  if (normalized.includes('household')) return 'home';
  return 'shopping_basket';
}

function getCategoryAccent(category: string) {
  const normalized = category.toLowerCase();

  if (normalized.includes('produce')) return '#84ac8e';
  if (normalized.includes('dairy')) return '#5da9e9';
  if (normalized.includes('pantry')) return '#fd898a';
  if (normalized.includes('household')) return '#f4d35e';
  return 'var(--primary-container)';
}

export function ShoppingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const bootstrapQuery = useBootstrap();
  const shoppingItemsQuery = useShoppingItems();
  const createShoppingItemMutation = useCreateShoppingItem();
  const updateShoppingItemMutation = useUpdateShoppingItem();
  const deleteShoppingItemMutation = useDeleteShoppingItem();

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState(defaultCategories[0]);
  const [addedByProfileId, setAddedByProfileId] = useState<string>('');
  const [showDetails, setShowDetails] = useState(false);
  const [formError, setFormError] = useState('');

  const groupedItems = useMemo(() => {
    const groups = new Map<string, typeof shoppingItemsQuery.data>();

    for (const item of shoppingItemsQuery.data ?? []) {
      const existing = groups.get(item.category) ?? [];
      groups.set(item.category, [...existing, item]);
    }

    return [...groups.entries()];
  }, [shoppingItemsQuery.data]);

  const isSheetOpen = searchParams.get('sheet') === 'add-item';

  function openSheet() {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('sheet', 'add-item');
    setSearchParams(nextSearchParams, { replace: false });
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  function closeSheet() {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('sheet');
    setSearchParams(nextSearchParams, { replace: false });
    setFormError('');
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!label.trim()) {
      setFormError('Add an item name before saving.');
      return;
    }

    setFormError('');

    await createShoppingItemMutation.mutateAsync({
      label: label.trim(),
      category,
      addedByProfileId: addedByProfileId || null,
    });

    setLabel('');
    setAddedByProfileId('');
    closeSheet();
  }

  return (
    <section className="page shopping-page">
      <p className="eyebrow">Shopping</p>
      <h2 className="page-title">Shared list</h2>
      <p className="page-copy">
        Quickly add items, group them by category, and mark them complete during the shop.
      </p>

      <section className="shopping-quick-add-card calendar-action-card">
        <div>
          <p className="eyebrow">Quick add</p>
          <h3 className="profile-card-title">Keep grocery capture one tap away</h3>
          <p className="shopping-meta">Use the floating action button or the add action below to open the item sheet.</p>
        </div>
        <button className="primary-button" type="button" onClick={openSheet}>
          Add item
        </button>
      </section>

      {shoppingItemsQuery.isLoading ? <p className="page-copy">Loading shopping list...</p> : null}
      {shoppingItemsQuery.isError ? <p className="form-error">Unable to load shopping items.</p> : null}

      <div className="shopping-groups">
        {groupedItems.length > 0 ? (
          groupedItems.map(([group, items]) => (
            <article key={group} className="shopping-group-card">
              <div className="shopping-group-header shopping-group-header-decorated" style={{ borderLeftColor: getCategoryAccent(group) }}>
                <h3 className="profile-card-title shopping-group-title">
                  <span className="material-symbols-outlined shopping-group-icon" aria-hidden="true">
                    {getCategoryIcon(group)}
                  </span>
                  {group}
                </h3>
                <span className="shopping-group-count-badge">{items?.length ?? 0}</span>
              </div>

              <ul className="shopping-list">
                {items?.map((item) => {
                  const addedBy = bootstrapQuery.data?.profiles.find((profile) => profile.id === item.addedByProfileId);

                  return (
                    <li key={item.id} className={item.isCompleted ? 'shopping-list-item shopping-list-item-complete' : 'shopping-list-item'}>
                      <label className="shopping-checkbox-row">
                        <span className="shopping-item-icon" aria-hidden="true">
                          <span className="material-symbols-outlined" aria-hidden="true">{getCategoryIcon(item.category)}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={item.isCompleted}
                          onChange={(event) =>
                            updateShoppingItemMutation.mutate({
                              itemId: item.id,
                              isCompleted: event.target.checked,
                            })
                          }
                        />
                        <span className={item.isCompleted ? 'shopping-item-label shopping-item-label-complete' : 'shopping-item-label'}>
                          {item.label}
                        </span>
                      </label>

                      <div className="shopping-item-side">
                        {addedBy ? <span className={getProfileColorChipClass(addedBy.colorKey)}>{addedBy.displayName}</span> : null}
                        <button
                          className="destructive-button calendar-small-button"
                          type="button"
                          aria-label={`Remove ${item.label} from list`}
                          onClick={() => deleteShoppingItemMutation.mutate(item.id)}
                          disabled={deleteShoppingItemMutation.isPending}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </article>
          ))
        ) : (
          <div className="dashboard-empty-card">
            <p className="shopping-meta">Your shared list is clear. Add the next item when it comes to mind.</p>
          </div>
        )}
      </div>

      <button className="floating-action-button" type="button" aria-label="Add shopping item" onClick={openSheet}>
        Add item
      </button>

      {isSheetOpen ? (
        <>
          <button className="mobile-sheet-backdrop" type="button" aria-label="Close shopping item sheet" onClick={closeSheet} />
          <section className="mobile-sheet" role="dialog" aria-modal="true" aria-labelledby="shopping-sheet-title">
            <div className="mobile-sheet-header">
              <div>
                <p className="eyebrow">Quick add</p>
                <h3 id="shopping-sheet-title" className="profile-card-title">Add shopping item</h3>
              </div>
              <button className="secondary-button calendar-small-button" type="button" onClick={closeSheet}>
                Close
              </button>
            </div>

            <form className="shopping-form mobile-sheet-content" onSubmit={handleSubmit}>
              <label className="field shopping-field-wide">
                <span>Item name</span>
                <input
                  ref={inputRef}
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Add item (e.g., Milk)"
                  type="text"
                />
              </label>

              <label className="field">
                <span>Category</span>
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  {defaultCategories.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <button
                className="secondary-button calendar-small-button shopping-field-wide"
                type="button"
                onClick={() => setShowDetails((current) => !current)}
              >
                {showDetails ? 'Hide extra details' : 'Show extra details'}
              </button>

              {showDetails ? (
                <label className="field">
                  <span>Added by</span>
                  <select value={addedByProfileId} onChange={(event) => setAddedByProfileId(event.target.value)}>
                    <option value="">No profile</option>
                    {bootstrapQuery.data?.profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {formError ? <p className="form-error shopping-field-wide">{formError}</p> : null}

              <div className="mobile-sheet-actions shopping-field-wide">
                <button className="secondary-button" type="button" onClick={closeSheet}>
                  Cancel
                </button>
                <button className="primary-button" type="submit" disabled={createShoppingItemMutation.isPending}>
                  {createShoppingItemMutation.isPending ? 'Adding...' : 'Add item'}
                </button>
              </div>
            </form>
          </section>
        </>
      ) : null}
    </section>
  );
}
