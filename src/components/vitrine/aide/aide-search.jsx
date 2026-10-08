"use client"

import { useState } from "react"
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { PageHead } from "../shared/page-head"
import { Faq } from "../shared/faq"
import { FaqHashOpener } from "../shared/faq-hash"
import { StateBlock } from "../shared/state-block"
import { POPULAR_QUESTIONS } from "./aide-content"

/** Minuscules et sans accents, pour une recherche tolérante. */
export function normalize(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

function searchableText(item) {
  const steps = (item.steps ?? []).flatMap((s) => [s.title, s.text])
  return normalize([item.question, ...item.answer, ...steps, item.notice].filter(Boolean).join(" "))
}

/**
 * Filtre les thèmes selon la requête et retire les thèmes sans résultat.
 * Une requête vide renvoie tous les thèmes. Tous les mots doivent être présents.
 */
export function filterThemes(themes, query) {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return themes
  return themes
    .map((theme) => ({
      ...theme,
      items: theme.items.filter((item) => {
        const text = searchableText(item)
        return words.every((word) => text.includes(word))
      }),
    }))
    .filter((theme) => theme.items.length > 0)
}

function renderAnswer(item) {
  const [first, ...rest] = item.answer
  return (
    <div className="v07-a">
      <p>{first}</p>
      {item.steps ? (
        <div className="v-achats__steps">
          {item.steps.map((step, index) => (
            <div key={step.title} className={`v-achats__step${index === item.steps.length - 1 ? " v-achats__step--citron" : ""}`}>
              <div>
                <b>{step.title}</b>
                <div className="caption">{step.text}</div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {rest.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {item.notice ? (
        <div className="banner banner--alerte-doux">
          <Icon name="i-alert-triangle" />
          <div className="banner__body">
            <b>{item.notice}</b>
          </div>
        </div>
      ) : null}
      {item.links?.length ? (
        <p>
          {item.links.map(({ href, label }) => (
            <Link key={href} className="link" href={href}>{label}</Link>
          ))}
        </p>
      ) : null}
    </div>
  )
}

// En-tête avec recherche, thèmes et questions. Sans JavaScript, toute la FAQ reste rendue.
export function AideSearch({ themes }) {
  const [query, setQuery] = useState("")
  const [activeId, setActiveId] = useState(themes[0]?.id)
  const visible = filterThemes(themes, query)

  return (
    <>
      <PageHead
        eyebrow="Aide et FAQ"
        title={<>Une question&nbsp;?<br /><span className="hl-citron">On t&apos;aide.</span></>}
      >
        <Icon name="sc-squiggle" className="scribble v07-scribble--a" />
        <Icon name="sc-burst" className="scribble v07-scribble--b" />
        <form className="search search--hero v07-search" role="search" onSubmit={(event) => event.preventDefault()}>
          <Icon name="i-search" />
          <input
            type="search"
            aria-label="Rechercher dans l'aide"
            placeholder="Retrait, séquestre, carte étudiante…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="btn btn--primary" type="submit">Chercher</button>
        </form>
        <div className="v-popular on-bleu">
          <span>Les plus lues&nbsp;:</span>
          {POPULAR_QUESTIONS.map(({ id, label }) => (
            <a key={id} className="chip chip--sm" href={`#${id}`}>{label}</a>
          ))}
        </div>
      </PageHead>

      <section className="section ds-pt-6">
        <div className="ds-container">
          <div className="v07-themes">
            {themes.map((theme) => (
              <a
                key={theme.id}
                className={`v07-theme${theme.id === activeId ? " is-active" : ""}`}
                href={`#${theme.id}`}
                onClick={() => setActiveId(theme.id)}
              >
                <span className={`ic-sq${theme.id === activeId ? " ic-sq--blanc" : ""}`}>
                  <Icon name={theme.icon} />
                </span>
                <div>
                  <b>{theme.title}</b>
                  <small>{theme.items.length} questions</small>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="ds-container">
          {visible.length === 0 ? (
            <StateBlock
              title="Aucun résultat"
              text="Aucune question ne correspond à ta recherche. Essaie un autre mot, ou écris-nous."
              actions={[{ href: "/contact", label: "Nous contacter" }]}
            />
          ) : (
            <div className="v07-body">
              <nav className="v07-toc" aria-label="Thèmes">
                {visible.map((theme) => (
                  <a
                    key={theme.id}
                    href={`#${theme.id}`}
                    className={theme.id === activeId ? "is-active" : undefined}
                    onClick={() => setActiveId(theme.id)}
                  >
                    {theme.title}
                    <span className={`count ${theme.id === activeId ? "count--citron" : "count--neutre"}`}>
                      {theme.items.length}
                    </span>
                  </a>
                ))}
              </nav>
              <div>
                {visible.map((theme) => (
                  <div key={theme.id} className="v07-group" id={theme.id}>
                    <h3>
                      <span className="ic-sq ic-sq--sm"><Icon name={theme.icon} /></span>
                      {theme.title}
                    </h3>
                    <Faq
                      headingLevel={4}
                      items={theme.items.map((item) => ({
                        id: item.id,
                        question: item.question,
                        answer: renderAnswer(item),
                      }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
      <FaqHashOpener />
    </>
  )
}
