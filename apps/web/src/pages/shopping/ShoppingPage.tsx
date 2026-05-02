import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { useBootstrap } from '../../processes/family-bootstrap/useBootstrap';
import {
  useCreateShoppingItem,
  useDeleteShoppingItem,
  useShoppingItems,
  useUpdateShoppingItem,
} from '../../entities/shopping-item/model/useShoppingItems';

const defaultCategories = ['produce', 'dairy', 'pantry', 'household'];

function normalizeCategoryKey(category: string) {
  return category.trim().toLowerCase();
}

function getProfileColorChipClass(colorKey: string | null | undefined) {
  return colorKey ? `profile-color-chip profile-color-chip-${colorKey}` : 'profile-color-chip';
}

function getCategoryIcon(key: string) {
  if (key === 'produce') return 'local_florist';
  if (key === 'dairy') return 'egg_alt';
  if (key === 'pantry') return 'kitchen';
  if (key === 'household') return 'home';
  return 'shopping_basket';
}

function getCategoryAccent(key: string) {
  if (key === 'produce') return '#84ac8e';
  if (key === 'dairy') return '#5da9e9';
  if (key === 'pantry') return '#fd898a';
  if (key === 'household') return '#f4d35e';
  return 'var(--primary-container)';
}

export function ShoppingPage() {
  const { t } = useTranslation('shopping');
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
      const key = normalizeCategoryKey(item.category);
      const existing = groups.get(key) ?? [];
      groups.set(key, [...existing, item]);
    }

    return [...groups.entries()];
  }, [shoppingItemsQuery.data]);

  const isSheetOpen = searchParams.get('sheet') === 'add-item';

  useEffect(() => {
    document.body.classList.toggle('body-modal-open', isSheetOpen);

    return () => {
      document.body.classList.remove('body-modal-open');
    };
  }, [isSheetOpen]);

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
      setFormError(t('errors.itemName'));
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
      <p className="eyebrow">{t('eyebrow')}</p>
      <h2 className="page-title">{t('title')}</h2>
      <p className="page-copy">
        {t('description')}
      </p>

      <section className="shopping-quick-add-card calendar-action-card">
        <div>
          <p className="eyebrow">{t('quickAdd.eyebrow')}</p>
          <h3 className="profile-card-title">{t('quickAdd.title')}</h3>
          <p className="shopping-meta">{t('quickAdd.description')}</p>
        </div>
        <button className="primary-button" type="button" onClick={openSheet}>
          {t('addItem')}
        </button>
      </section>

      {shoppingItemsQuery.isLoading ? <p className="page-copy">{t('loading')}</p> : null}
      {shoppingItemsQuery.isError ? <p className="form-error">{t('error')}</p> : null}

      <div className="shopping-groups">
        {groupedItems.length > 0 ? (
          groupedItems.map(([group, items]) => (
            <article key={group} className="shopping-group-card">
              <div className="shopping-group-header shopping-group-header-decorated" style={{ borderLeftColor: getCategoryAccent(group) }}>
                <h3 className="profile-card-title shopping-group-title">
                  <span className="material-symbols-outlined shopping-group-icon" aria-hidden="true">
                    {getCategoryIcon(group)}
                  </span>
                  {t(`categories.${group}`, { defaultValue: group })}
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
                          <span className="material-symbols-outlined" aria-hidden="true">{getCategoryIcon(normalizeCategoryKey(item.category))}</span>
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
                          aria-label={t('removeItemAria', { label: item.label })}
                          onClick={() => deleteShoppingItemMutation.mutate(item.id)}
                          disabled={deleteShoppingItemMutation.isPending}
                        >
                          {t('remove')}
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
            <p className="shopping-meta">{t('empty')}</p>
          </div>
        )}
      </div>

      <button className="floating-action-button" type="button" aria-label={t('addShoppingItemAria')} onClick={openSheet}>
        {t('addItem')}
      </button>

      {isSheetOpen ? (
        <>
          <button className="mobile-sheet-backdrop" type="button" aria-label={t('closeSheetAria')} onClick={closeSheet} />
          <section className="mobile-sheet" role="dialog" aria-modal="true" aria-labelledby="shopping-sheet-title">
            <div className="mobile-sheet-header">
              <div>
                <p className="eyebrow">{t('quickAdd.eyebrow')}</p>
                <h3 id="shopping-sheet-title" className="profile-card-title">{t('sheet.title')}</h3>
              </div>
              <button className="secondary-button calendar-small-button" type="button" onClick={closeSheet}>
                {t('close')}
              </button>
            </div>

            <form className="shopping-form mobile-sheet-content" onSubmit={handleSubmit}>
              <label className="field shopping-field-wide">
                <span>{t('fields.itemName')}</span>
                <input
                  ref={inputRef}
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder={t('fields.itemNamePlaceholder')}
                  type="text"
                />
              </label>

              <label className="field">
                <span>{t('fields.category')}</span>
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  {defaultCategories.map((option) => (
                    <option key={option} value={option}>
                      {t(`categories.${option}`)}
                    </option>
                  ))}
                </select>
              </label>

              <button
                className="secondary-button calendar-small-button shopping-field-wide"
                type="button"
                onClick={() => setShowDetails((current) => !current)}
              >
                {showDetails ? t('hideExtraDetails') : t('showExtraDetails')}
              </button>

              {showDetails ? (
                <label className="field">
                  <span>{t('fields.addedBy')}</span>
                  <select value={addedByProfileId} onChange={(event) => setAddedByProfileId(event.target.value)}>
                    <option value="">{t('noProfile')}</option>
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
                  {t('cancel')}
                </button>
                <button className="primary-button" type="submit" disabled={createShoppingItemMutation.isPending}>
                  {createShoppingItemMutation.isPending ? t('adding') : t('addItem')}
                </button>
              </div>
            </form>
          </section>
        </>
      ) : null}
    </section>
  );
}
