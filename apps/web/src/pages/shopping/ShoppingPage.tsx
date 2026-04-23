import { useMemo, useState } from 'react';

import { useBootstrap } from '../../processes/family-bootstrap/useBootstrap';
import {
  useCreateShoppingItem,
  useShoppingItems,
  useUpdateShoppingItem,
} from '../../entities/shopping-item/model/useShoppingItems';

const defaultCategories = ['Produce', 'Dairy', 'Pantry', 'Household'];

export function ShoppingPage() {
  const bootstrapQuery = useBootstrap();
  const shoppingItemsQuery = useShoppingItems();
  const createShoppingItemMutation = useCreateShoppingItem();
  const updateShoppingItemMutation = useUpdateShoppingItem();

  const [label, setLabel] = useState('');
  const [category, setCategory] = useState(defaultCategories[0]);
  const [addedByProfileId, setAddedByProfileId] = useState<string>('');

  const groupedItems = useMemo(() => {
    const groups = new Map<string, typeof shoppingItemsQuery.data>();

    for (const item of shoppingItemsQuery.data ?? []) {
      const existing = groups.get(item.category) ?? [];
      groups.set(item.category, [...existing, item]);
    }

    return [...groups.entries()];
  }, [shoppingItemsQuery.data]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!label.trim()) {
      return;
    }

    await createShoppingItemMutation.mutateAsync({
      label: label.trim(),
      category,
      addedByProfileId: addedByProfileId || null,
    });

    setLabel('');
    setCategory(defaultCategories[0]);
    setAddedByProfileId('');
  }

  return (
    <section className="page">
      <p className="eyebrow">Shopping</p>
      <h2 className="page-title">Shared list</h2>
      <p className="page-copy">
        Quickly add items, group them by category, and mark them complete during the shop.
      </p>

      <form className="shopping-form" onSubmit={handleSubmit}>
        <label className="field shopping-field-wide">
          <span>Item</span>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Add an item"
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

        <button className="primary-button" type="submit" disabled={createShoppingItemMutation.isPending}>
          {createShoppingItemMutation.isPending ? 'Adding...' : 'Add item'}
        </button>
      </form>

      {shoppingItemsQuery.isLoading ? <p className="page-copy">Loading shopping list...</p> : null}
      {shoppingItemsQuery.isError ? <p className="form-error">Unable to load shopping items.</p> : null}

      <div className="shopping-groups">
        {groupedItems.map(([group, items]) => (
          <article key={group} className="shopping-group-card">
            <div className="shopping-group-header">
              <h3 className="profile-card-title">{group}</h3>
              <span className="profile-color-chip">{items?.length ?? 0} items</span>
            </div>

            <ul className="shopping-list">
              {items?.map((item) => {
                const addedBy = bootstrapQuery.data?.profiles.find((profile) => profile.id === item.addedByProfileId);

                return (
                  <li key={item.id} className="shopping-list-item">
                    <label className="shopping-checkbox-row">
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

                    {addedBy ? <span className="shopping-meta">{addedBy.displayName}</span> : null}
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
