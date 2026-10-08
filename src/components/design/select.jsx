"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import {
  choosePlacement, firstEnabled, indexOfValue, initialActive, keyIntent, lastEnabled,
  moveActive, nextBuffer, typeaheadIndex, TYPEAHEAD_RESET_MS,
} from "@/components/design/select-logic"

const cx = (...parts) => parts.filter(Boolean).join(" ")

// Sélection maison (motif APG "select-only combobox"), indépendante du <select> natif.
// Variantes : "chip" (puce de filtre), "bare" (champ ville dans une pastille de recherche),
// "field" (champ de formulaire .select). Contrôlé (value/onChange) ou non (defaultValue).
// Une option peut porter `triggerLabel` (libellé court affiché sur le déclencheur).
// `name` rend un <input type="hidden"> pour la soumission native.
export function Select({
  options,
  value,
  defaultValue = "",
  onChange,
  onBlur,
  name,
  id,
  variant = "field",
  size,
  icon,
  placeholder = "",
  title,
  selected = false,
  invalid = false,
  disabled = false,
  required = false,
  className,
  ref,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  "aria-describedby": ariaDescribedby,
}) {
  const uid = useId()
  const listId = `${uid}-list`
  const optionId = (i) => `${uid}-opt-${i}`

  const [innerValue, setInnerValue] = useState(defaultValue)
  const current = value !== undefined ? value : innerValue
  const currentIndex = indexOfValue(options, current)
  const currentOption = options[currentIndex]
  const hasValue = Boolean(currentOption) && current !== ""

  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [placement, setPlacement] = useState({ vertical: "bottom", horizontal: "start" })

  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const bufferRef = useRef(null)
  const menuRef = useRef(null)

  const setTriggerRef = (node) => {
    triggerRef.current = node
    if (typeof ref === "function") ref(node)
    else if (ref) ref.current = node
  }

  // Mesure la liste réelle avant de l'ouvrir : elle est rendue (masquée) en permanence, on la déplie
  // le temps de la mesure, sans peinture entre les deux. L'ancre est son offsetParent : la racine du
  // Select, ou la pastille de recherche en variante bare (la liste s'y aligne, pas sur le déclencheur).
  const openList = (index) => {
    const menu = menuRef.current
    menu.style.maxHeight = ""
    menu.hidden = false
    const anchor = menu.offsetParent ?? rootRef.current
    const next = choosePlacement({
      rect: anchor.getBoundingClientRect(),
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: window.innerHeight,
      menuHeight: menu.scrollHeight + menu.offsetHeight - menu.clientHeight,
      menuWidth: menu.offsetWidth,
    })
    menu.hidden = true
    // Plafond mesuré en pixels : la liste défile seulement quand aucun côté ne la contient entière.
    if (next.maxHeight !== null) menu.style.maxHeight = `${next.maxHeight}px`
    setPlacement(next)
    setActive(index ?? initialActive(options, current))
    setOpen(true)
  }

  const closeList = () => {
    setOpen(false)
    bufferRef.current = null
  }

  const commit = (index) => {
    const option = options[index]
    if (!option || option.disabled) return
    if (option.value !== current) {
      if (value === undefined) setInnerValue(option.value)
      onChange?.(option.value)
    }
  }

  const pick = (index) => {
    commit(index)
    closeList()
    triggerRef.current?.focus()
  }

  const typeInto = (key) => {
    bufferRef.current = nextBuffer(bufferRef.current, key, Date.now())
    const from = open ? active : currentIndex
    return typeaheadIndex(options, from, bufferRef.current.text)
  }

  const onKeyDown = (e) => {
    if (disabled) return
    const typing = Boolean(bufferRef.current) && Date.now() - bufferRef.current.at <= TYPEAHEAD_RESET_MS
    const intent = keyIntent({
      key: e.key, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, open, typing,
    })
    if (intent === "none") return
    if (intent !== "tab") e.preventDefault()
    // Échap ferme seulement la liste : une modale ou une feuille parente reste ouverte.
    if (intent === "close") e.stopPropagation()

    switch (intent) {
      case "open": openList(); break
      case "open-first": openList(firstEnabled(options)); break
      case "open-last": openList(lastEnabled(options)); break
      case "open-type": {
        const next = typeInto(e.key)
        openList(next >= 0 ? next : undefined)
        break
      }
      case "next": setActive(moveActive(options, active, 1)); break
      case "prev": setActive(moveActive(options, active, -1)); break
      case "first": setActive(firstEnabled(options)); break
      case "last": setActive(lastEnabled(options)); break
      case "type": setActive(typeInto(e.key)); break
      case "select": pick(active); break
      case "close": closeList(); break
      case "tab": commit(active); closeList(); break
    }
  }

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) closeList()
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  // Comme un select natif, la liste se ferme quand la page défile ou que la fenêtre change de taille
  // (le défilement interne de la liste ne la ferme pas).
  useEffect(() => {
    if (!open) return undefined
    const onScroll = (e) => {
      if (!menuRef.current?.contains(e.target)) closeList()
    }
    window.addEventListener("scroll", onScroll, { capture: true, passive: true })
    window.addEventListener("resize", closeList)
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true })
      window.removeEventListener("resize", closeList)
    }
  }, [open])

  // Fait défiler la liste elle-même (jamais un conteneur parent) jusqu'à l'option active.
  useEffect(() => {
    const menu = menuRef.current
    const option = open && active >= 0 ? document.getElementById(optionId(active)) : null
    if (menu && option) {
      if (option.offsetTop < menu.scrollTop) menu.scrollTop = option.offsetTop
      else if (option.offsetTop + option.offsetHeight > menu.scrollTop + menu.clientHeight) {
        menu.scrollTop = option.offsetTop + option.offsetHeight - menu.clientHeight
      }
    }
  // optionId dépend seulement de uid
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active])

  const label = hasValue ? (currentOption.triggerLabel ?? currentOption.label) : placeholder
  const triggerClass = {
    chip: cx("chip chip--dropdown", size === "sm" && "chip--sm", selected && "is-selected"),
    bare: "ds-select__bare",
    field: cx("select", !hasValue && "is-placeholder", invalid && "is-error", open && "is-open"),
  }[variant]

  return (
    <div
      ref={rootRef}
      className={cx("ds-select", `ds-select--${variant}`, open && "is-open", className)}
      data-vertical={placement.vertical}
      data-horizontal={placement.horizontal}
    >
      {name ? <input type="hidden" name={name} value={current} disabled={disabled} /> : null}
      <button
        ref={setTriggerRef}
        id={id}
        type="button"
        role="combobox"
        className={triggerClass}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        aria-describedby={ariaDescribedby}
        aria-invalid={invalid ? "true" : undefined}
        aria-required={required ? "true" : undefined}
        onClick={() => {
          // Safari ne donne pas le focus à un bouton cliqué : sans lui, Échap et les flèches seraient perdus.
          triggerRef.current?.focus()
          if (open) closeList()
          else openList()
        }}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => {
          // Firefox active un bouton à la levée d'Espace : sans ceci la liste s'ouvrirait puis se fermerait.
          if (e.key === " ") e.preventDefault()
        }}
        onBlur={(e) => {
          if (!rootRef.current?.contains(e.relatedTarget)) closeList()
          onBlur?.(e)
        }}
      >
        {variant === "chip" && icon ? <Icon name={icon} className="ic" /> : null}
        <span>{label}</span>
        {variant === "bare" ? <Icon name="i-chevron-down" className="ic ic--16" /> : null}
      </button>
      <div
        id={listId}
        ref={menuRef}
        role="listbox"
        className="menu ds-select__menu"
        hidden={!open}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        onMouseDown={(e) => e.preventDefault()}
      >
        {title ? <div className="menu__title" aria-hidden="true">{title}</div> : null}
        {options.map((o, i) => (
          <div
            key={o.value}
            id={optionId(i)}
            role="option"
            className={cx(
              "menu__item",
              i === currentIndex && "is-selected",
              open && i === active && "is-hover",
              o.disabled && "is-disabled",
            )}
            aria-selected={i === currentIndex}
            aria-disabled={o.disabled ? "true" : undefined}
            onClick={() => { if (!o.disabled) pick(i) }}
            onMouseMove={() => { if (!o.disabled && i !== active) setActive(i) }}
          >
            {o.label}
          </div>
        ))}
      </div>
    </div>
  )
}

export default Select
