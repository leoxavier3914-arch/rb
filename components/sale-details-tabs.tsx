"use client"

import { useId, useRef, useState, type KeyboardEvent } from "react"
import clsx from "clsx"

export type DetailListItem = {
  label: string
  value: string
}

export type DetailItem = {
  label: string
  value: string | null
  list?: DetailListItem[]
}

type Section = {
  id: string
  label: string
  items: DetailItem[]
}

const fallbackValue = (value: string | null | undefined) => {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/70">—</span>
  }

  if (typeof value === "string" && value.trim().length === 0) {
    return <span className="text-muted-foreground/70">—</span>
  }

  return value
}

const DetailsSection = ({ title, items }: { title: string; items: DetailItem[] }) => {
  return (
    <section className="rounded-3xl border border-surface-accent/40 bg-surface-accent/60 p-6 shadow-soft">
      <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">{title}</h3>
      <dl className="mt-4 space-y-3 text-sm">
        {items.map((item) => {
          const hasList = item.list && item.list.length > 0
          return (
            <div key={item.label} className="flex flex-col gap-1">
              <dt className="text-muted-foreground/80">{item.label}</dt>
              <dd className="font-medium text-primary-foreground">
                {hasList ? (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {item.list?.map((entry) => (
                      <li key={entry.label}>
                        <span className="text-muted-foreground/80">{entry.label}:</span> {entry.value}
                      </li>
                    ))}
                  </ul>
                ) : (
                  fallbackValue(item.value)
                )}
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}

const SaleDetailsTabs = ({ sections }: { sections: Section[] }) => {
  if (sections.length === 0) {
    return null
  }

  const [activeTab, setActiveTab] = useState(sections[0]?.id ?? "")
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const baseId = useId()

  const focusTabAtIndex = (index: number) => {
    const clampedIndex = (index + sections.length) % sections.length
    const ref = tabRefs.current[clampedIndex]
    ref?.focus()
    setActiveTab(sections[clampedIndex]?.id ?? "")
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault()
      focusTabAtIndex(index + 1)
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault()
      focusTabAtIndex(index - 1)
    } else if (event.key === "Home") {
      event.preventDefault()
      focusTabAtIndex(0)
    } else if (event.key === "End") {
      event.preventDefault()
      focusTabAtIndex(sections.length - 1)
    }
  }

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Detalhes da venda" className="flex flex-wrap gap-2">
        {sections.map((section, index) => {
          const isActive = section.id === activeTab
          const tabId = `${baseId}-${section.id}-tab`
          const panelId = `${baseId}-${section.id}-panel`
          return (
            <button
              key={section.id}
              ref={(element) => {
                tabRefs.current[index] = element
              }}
              type="button"
              id={tabId}
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(section.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={clsx(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-soft"
                  : "border-surface-accent/60 bg-surface-accent text-muted-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground"
              )}
            >
              {section.label}
            </button>
          )
        })}
      </div>

      {sections.map((section) => {
        const isActive = section.id === activeTab
        const tabId = `${baseId}-${section.id}-tab`
        const panelId = `${baseId}-${section.id}-panel`
        return (
          <div
            key={section.id}
            role="tabpanel"
            id={panelId}
            aria-labelledby={tabId}
            hidden={!isActive}
            className={clsx(!isActive && "hidden")}
          >
            {isActive ? <DetailsSection title={section.label} items={section.items} /> : null}
          </div>
        )
      })}
    </div>
  )
}

export default SaleDetailsTabs
