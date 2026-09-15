"use client";

import {
  CaretDown,
  Check,
  CircleNotch,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export type SelectMenuOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export type SelectMenuGroup = {
  label?: string;
  options: SelectMenuOption[];
};

export function SelectMenu({
  ariaLabel,
  groups,
  value,
  placeholder,
  loading = false,
  disabled = false,
  searchable = false,
  searchPlaceholder = "搜索选项",
  emptyText = "没有匹配选项",
  invalid = false,
  title,
  className = "",
  onChange,
}: {
  ariaLabel: string;
  groups: SelectMenuGroup[];
  value: string;
  placeholder: string;
  loading?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  invalid?: boolean;
  title?: string;
  className?: string;
  onChange: (value: string) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typeaheadRef = useRef("");
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listboxId = useId();
  const optionIdPrefix = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const allOptions = useMemo(
    () => groups.flatMap((group) => group.options),
    [groups],
  );
  const selectedOption = allOptions.find((option) => option.value === value);
  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!searchable || !normalizedQuery) return groups;
    return groups
      .map((group) => ({
        ...group,
        options: group.options.filter((option) =>
          `${option.label} ${option.description || ""}`
            .toLocaleLowerCase()
            .includes(normalizedQuery),
        ),
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, query, searchable]);
  const visibleOptions = useMemo(
    () => filteredGroups.flatMap((group) => group.options),
    [filteredGroups],
  );
  const unavailable = loading || disabled || allOptions.length === 0;
  const selectedVisibleIndex = visibleOptions.findIndex(
    (option) => option.value === value,
  );
  const [activeIndex, setActiveIndex] = useState(
    selectedVisibleIndex >= 0 ? selectedVisibleIndex : 0,
  );

  useEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;
    const handleToggle = (event: Event) => {
      const nextOpen = (event as ToggleEvent).newState === "open";
      setOpen(nextOpen);
      if (!nextOpen) {
        setQuery("");
        return;
      }
      setActiveIndex(selectedVisibleIndex >= 0 ? selectedVisibleIndex : 0);
      requestAnimationFrame(() => {
        positionPopover();
        if (searchable) searchRef.current?.focus();
        else listboxRef.current?.focus();
      });
    };
    popover.addEventListener("toggle", handleToggle);
    return () => popover.removeEventListener("toggle", handleToggle);
  }, [searchable, selectedVisibleIndex]);

  useEffect(() => {
    if (unavailable && popoverRef.current?.matches(":popover-open")) {
      popoverRef.current.hidePopover();
    }
  }, [unavailable]);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => positionPopover();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !visibleOptions.length) return;
    const nextIndex = selectedVisibleIndex >= 0 ? selectedVisibleIndex : 0;
    setActiveIndex(nextIndex);
  }, [open, query, selectedVisibleIndex, visibleOptions.length]);

  useEffect(() => {
    if (!open || !visibleOptions.length) return;
    document
      .getElementById(`${optionIdPrefix}-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, optionIdPrefix, visibleOptions.length]);

  useEffect(
    () => () => {
      if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
    },
    [],
  );

  function positionPopover() {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) return;

    const viewportGap = 8;
    const triggerRect = trigger.getBoundingClientRect();
    const popoverWidth = Math.min(
      Math.max(triggerRect.width, searchable ? 280 : 220),
      window.innerWidth - viewportGap * 2,
    );
    const roomBelow = window.innerHeight - triggerRect.bottom - viewportGap;
    const roomAbove = triggerRect.top - viewportGap;
    const opensAbove = roomBelow < 180 && roomAbove > roomBelow;
    const availableRoom = opensAbove ? roomAbove : roomBelow;
    const popoverHeight = Math.max(120, Math.min(360, availableRoom));
    const left = Math.min(
      Math.max(viewportGap, triggerRect.left),
      window.innerWidth - popoverWidth - viewportGap,
    );
    const renderedHeight = popover.matches(":popover-open")
      ? Math.min(popover.scrollHeight, popoverHeight)
      : popoverHeight;
    const top = opensAbove
      ? Math.max(viewportGap, triggerRect.top - renderedHeight - viewportGap)
      : triggerRect.bottom + viewportGap;

    popover.style.setProperty("--select-menu-left", `${left}px`);
    popover.style.setProperty("--select-menu-top", `${top}px`);
    popover.style.setProperty("--select-menu-width", `${popoverWidth}px`);
    popover.style.setProperty("--select-menu-max-height", `${popoverHeight}px`);
    popover.dataset.placement = opensAbove ? "above" : "below";
  }

  function openMenu(preferredIndex = selectedVisibleIndex) {
    const popover = popoverRef.current;
    if (!popover || unavailable) return;
    positionPopover();
    setActiveIndex(preferredIndex >= 0 ? preferredIndex : 0);
    if (!popover.matches(":popover-open")) popover.showPopover();
  }

  function closeMenu({ restoreFocus = true } = {}) {
    const popover = popoverRef.current;
    if (popover?.matches(":popover-open")) popover.hidePopover();
    if (restoreFocus) triggerRef.current?.focus();
  }

  function enabledIndex(start: number, direction: 1 | -1) {
    if (!visibleOptions.length) return -1;
    let index = start;
    for (let count = 0; count < visibleOptions.length; count += 1) {
      index =
        (index + direction + visibleOptions.length) % visibleOptions.length;
      if (!visibleOptions[index]?.disabled) return index;
    }
    return -1;
  }

  function selectOption(index: number) {
    const option = visibleOptions[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    closeMenu();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const fallback = event.key === "ArrowDown" ? -1 : 0;
      const nextIndex =
        selectedVisibleIndex >= 0
          ? selectedVisibleIndex
          : enabledIndex(fallback, event.key === "ArrowDown" ? 1 : -1);
      openMenu(nextIndex);
    }
  }

  function handlePopoverKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = enabledIndex(
        activeIndex,
        event.key === "ArrowDown" ? 1 : -1,
      );
      if (next >= 0) setActiveIndex(next);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const start = event.key === "Home" ? -1 : 0;
      const next = enabledIndex(start, event.key === "Home" ? 1 : -1);
      if (next >= 0) setActiveIndex(next);
      return;
    }
    if (event.key === "Enter" || (!searchable && event.key === " ")) {
      event.preventDefault();
      selectOption(activeIndex);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (event.key === "Tab") closeMenu({ restoreFocus: false });
    if (
      !searchable &&
      event.key.length === 1 &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      typeaheadRef.current += event.key.toLocaleLowerCase();
      if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
      typeaheadTimerRef.current = setTimeout(() => {
        typeaheadRef.current = "";
      }, 600);
      const matchIndex = visibleOptions.findIndex(
        (option) =>
          !option.disabled &&
          option.label.toLocaleLowerCase().startsWith(typeaheadRef.current),
      );
      if (matchIndex >= 0) setActiveIndex(matchIndex);
    }
  }

  let optionIndex = -1;
  const activeDescendant =
    visibleOptions.length && activeIndex >= 0
      ? `${optionIdPrefix}-${activeIndex}`
      : undefined;

  return (
    <div className={`select-menu ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        className="select-menu-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-invalid={invalid || undefined}
        disabled={unavailable}
        data-state={
          loading
            ? "loading"
            : invalid
              ? "error"
              : selectedOption
                ? "success"
                : "default"
        }
        title={title}
        onClick={() => {
          if (popoverRef.current?.matches(":popover-open")) closeMenu();
          else openMenu();
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="select-menu-label">
          {loading ? "正在读取" : selectedOption?.label || placeholder}
        </span>
        {loading ? (
          <CircleNotch className="select-menu-spinner" aria-hidden="true" />
        ) : (
          <CaretDown className="select-menu-caret" aria-hidden="true" />
        )}
      </button>
      <div
        ref={popoverRef}
        className="select-menu-popover"
        popover="auto"
        data-searchable={searchable || undefined}
        onKeyDown={handlePopoverKeyDown}
      >
        {searchable && (
          <label className="select-menu-search">
            <MagnifyingGlass aria-hidden="true" />
            <span className="sr-only">{searchPlaceholder}</span>
            <input
              ref={searchRef}
              type="search"
              role="combobox"
              aria-label={searchPlaceholder}
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-activedescendant={activeDescendant}
              value={query}
              placeholder={searchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        )}
        <div
          ref={listboxRef}
          id={listboxId}
          className="select-menu-listbox"
          role="listbox"
          tabIndex={searchable ? undefined : -1}
          aria-label={ariaLabel}
          aria-activedescendant={activeDescendant}
        >
          {filteredGroups.map((group, groupIndex) => {
            const groupId = `${listboxId}-group-${groupIndex}`;
            return (
              <div
                key={`${group.label || "options"}-${groupIndex}`}
                className="select-menu-group"
                role={group.label ? "group" : "presentation"}
                aria-labelledby={group.label ? groupId : undefined}
              >
                {group.label && (
                  <div id={groupId} className="select-menu-group-label">
                    {group.label}
                  </div>
                )}
                {group.options.map((option) => {
                  optionIndex += 1;
                  const currentIndex = optionIndex;
                  const isSelected = option.value === value;
                  return (
                    <div
                      key={option.value}
                      id={`${optionIdPrefix}-${currentIndex}`}
                      className="select-menu-option"
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={option.disabled || undefined}
                      data-active={currentIndex === activeIndex}
                      onPointerMove={() => {
                        if (!option.disabled) setActiveIndex(currentIndex);
                      }}
                      onClick={() => selectOption(currentIndex)}
                    >
                      <span className="select-menu-option-copy">
                        <span>{option.label}</span>
                        {option.description && (
                          <small>{option.description}</small>
                        )}
                      </span>
                      {isSelected && <Check weight="bold" aria-hidden="true" />}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {!visibleOptions.length && (
            <p className="select-menu-empty">{emptyText}</p>
          )}
        </div>
      </div>
    </div>
  );
}
