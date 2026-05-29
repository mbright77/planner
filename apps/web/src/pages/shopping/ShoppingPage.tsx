import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon,
  Delete02Icon,
  Home01Icon,
  KitchenUtensilsIcon,
  MilkCartonIcon,
  NaturalFoodIcon,
  ShoppingBasket01Icon,
} from '@hugeicons/core-free-icons';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
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
  if (key === 'produce') return NaturalFoodIcon;
  if (key === 'dairy') return MilkCartonIcon;
  if (key === 'pantry') return KitchenUtensilsIcon;
  if (key === 'household') return Home01Icon;
  return ShoppingBasket01Icon;
}

export function ShoppingPage() {
  const { t } = useTranslation('shopping');
  const bootstrapQuery = useBootstrap();
  const shoppingItemsQuery = useShoppingItems();
  const createShoppingItemMutation = useCreateShoppingItem();
  const updateShoppingItemMutation = useUpdateShoppingItem();
  const deleteShoppingItemMutation = useDeleteShoppingItem();

  const [label, setLabel] = useState('');
  const [category, setCategory] = useState(defaultCategories[0]);
  const [addedByProfileId, setAddedByProfileId] = useState<string>('__none');
  const [formError, setFormError] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, typeof shoppingItemsQuery.data>();

    for (const item of shoppingItemsQuery.data ?? []) {
      const key = normalizeCategoryKey(item.category);
      const existing = groups.get(key) ?? [];
      groups.set(key, [...existing, item]);
    }

    return [...groups.entries()];
  }, [shoppingItemsQuery.data]);

  function resetDrawerForm() {
    setLabel('');
    setCategory(defaultCategories[0]);
    setAddedByProfileId('__none');
    setFormError('');
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
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
      addedByProfileId: addedByProfileId === '__none' ? null : addedByProfileId,
    });

    resetDrawerForm();
    closeDrawer();
  }

  return (
    <section className="flex flex-col gap-4 py-4 md:gap-6">
      <Card>
        <CardHeader>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('eyebrow')}</p>
          <CardTitle className="text-2xl md:text-3xl">{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('quickAdd.eyebrow')}</p>
            <CardTitle className="text-lg">{t('quickAdd.title')}</CardTitle>
            <CardDescription>{t('quickAdd.description')}</CardDescription>
          </div>

          <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <DrawerTrigger asChild>
              <Button type="button">
                <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" aria-hidden="true" />
                {t('addItem')}
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader className="text-left">
                <DrawerTitle>{t('sheet.title')}</DrawerTitle>
                <DrawerDescription>{t('quickAdd.description')}</DrawerDescription>
              </DrawerHeader>

              <form className="px-4 pb-2" onSubmit={handleSubmit}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="shopping-label">{t('fields.itemName')}</Label>
                    <Input
                      id="shopping-label"
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                      placeholder={t('fields.itemNamePlaceholder')}
                      type="text"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="shopping-category">{t('fields.category')}</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger id="shopping-category" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {defaultCategories.map((option) => (
                            <SelectItem key={option} value={option}>
                              {t(`categories.${option}`)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="shopping-added-by">{t('fields.addedBy')}</Label>
                    <Select value={addedByProfileId} onValueChange={(value) => setAddedByProfileId(value)}>
                      <SelectTrigger id="shopping-added-by" className="w-full">
                        <SelectValue placeholder={t('noProfile')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="__none">{t('noProfile')}</SelectItem>
                          {bootstrapQuery.data?.profiles.map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              {profile.displayName}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  {formError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{formError}</AlertDescription>
                    </Alert>
                  ) : null}
                </div>

                <DrawerFooter className="px-0">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <DrawerClose asChild>
                      <Button variant="outline" type="button" onClick={closeDrawer}>
                        {t('cancel')}
                      </Button>
                    </DrawerClose>
                    <Button type="submit" disabled={createShoppingItemMutation.isPending}>
                      {createShoppingItemMutation.isPending ? t('adding') : t('addItem')}
                    </Button>
                  </div>
                </DrawerFooter>
              </form>
            </DrawerContent>
          </Drawer>
        </CardHeader>
      </Card>

      {shoppingItemsQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      ) : null}

      {shoppingItemsQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{t('error')}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {groupedItems.length > 0 ? (
          groupedItems.map(([group, items]) => (
            <Card key={group} className="overflow-hidden">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <HugeiconsIcon icon={getCategoryIcon(group)} aria-hidden="true" />
                  {t(`categories.${group}`, { defaultValue: group })}
                </CardTitle>
                <Badge variant="secondary">{items?.length ?? 0}</Badge>
              </CardHeader>

              <CardContent>
                <ul className="flex flex-col gap-2" role="list">
                  {items?.map((item) => {
                    const addedBy = bootstrapQuery.data?.profiles.find((profile) => profile.id === item.addedByProfileId);

                    return (
                      <li
                        key={item.id}
                        role="listitem"
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
                      >
                        <label className="flex min-w-0 flex-1 items-center gap-3">
                          <Checkbox
                            checked={item.isCompleted}
                            onCheckedChange={(checked) =>
                              updateShoppingItemMutation.mutate({
                                itemId: item.id,
                                isCompleted: checked === true,
                              })
                            }
                            aria-label={item.label}
                          />
                          <span
                            className={
                              item.isCompleted
                                ? 'shopping-item-label-complete text-sm text-muted-foreground'
                                : 'text-sm font-medium text-foreground'
                            }
                          >
                            {item.label}
                          </span>
                        </label>

                        <div className="flex items-center gap-2">
                          {addedBy ? (
                            <span className={getProfileColorChipClass(addedBy.colorKey)}>{addedBy.displayName}</span>
                          ) : null}
                          <Button
                            variant="destructive"
                            size="icon-sm"
                            type="button"
                            aria-label={t('removeItemAria', { label: item.label })}
                            onClick={() => deleteShoppingItemMutation.mutate(item.id)}
                            disabled={deleteShoppingItemMutation.isPending}
                          >
                            <HugeiconsIcon icon={Delete02Icon} aria-hidden="true" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="md:col-span-2">
            <CardContent>
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
