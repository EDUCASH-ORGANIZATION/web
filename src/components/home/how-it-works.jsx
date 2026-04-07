"use client"

import * as Tabs from "@radix-ui/react-tabs"
import { UserCircle, Search, Wallet, Users, FileText, CreditCard } from "lucide-react"
import clsx from "clsx"

const STUDENT_STEPS = [
  {
    number: 1,
    icon: UserCircle,
    title: "Crée ton profil",
    description: "Renseigne tes compétences, ta disponibilité et uploade ta carte étudiante pour être vérifié sous 24h.",
  },
  {
    number: 2,
    icon: Search,
    title: "Postule aux missions",
    description: "Parcours les offres publiées par des clients près de chez toi et postule en un clic selon ton tarif.",
  },
  {
    number: 3,
    icon: Wallet,
    title: "Reçois ton paiement",
    description: "Une fois la mission validée, l'argent est disponible instantanément sur ton compte EduCash.",
  },
]

const CLIENT_STEPS = [
  {
    number: 1,
    icon: Users,
    title: "Crée ton compte",
    description: "Inscris-toi en 2 minutes. Particulier, entreprise ou association — on a tout prévu.",
  },
  {
    number: 2,
    icon: FileText,
    title: "Décris ton besoin",
    description: "Publie une mission avec le budget, la ville et le type de prestation. Reçois des candidatures rapidement.",
  },
  {
    number: 3,
    icon: CreditCard,
    title: "Paye en sécurité",
    description: "Règle via FedaPay. Le paiement est libéré uniquement quand vous validez ensemble la mission.",
  },
]

function StepCard({ step, isLast }) {
  const Icon = step.icon
  return (
    <div className="relative flex flex-col items-center text-center gap-4 px-4">
      {/* Connector line */}
      {!isLast && (
        <div className="hidden md:block absolute top-10 left-[calc(50%+2rem)] right-0 h-px border-t-2 border-dashed border-[#1A6B4A]/20" />
      )}
      {/* Circle */}
      <div className="relative z-10 w-16 h-16 rounded-2xl bg-[#f0faf5] border-2 border-[#1A6B4A]/20 flex items-center justify-center flex-col gap-0.5 shadow-sm">
        <Icon size={22} className="text-[#1A6B4A]" strokeWidth={1.75} />
        <span className="text-[10px] font-bold text-[#1A6B4A]/60">{step.number < 10 ? `0${step.number}` : step.number}</span>
      </div>
      <div>
        <p className="font-semibold text-gray-900 mb-1">{step.title}</p>
        <p className="text-sm text-gray-500 leading-relaxed max-w-[180px] mx-auto">{step.description}</p>
      </div>
    </div>
  )
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#1A6B4A] bg-[#f0faf5] px-3 py-1 rounded-full">
            Simple & Rapide
          </span>
          <h2 className="text-3xl font-bold text-gray-900 mt-4 mb-3">
            Comment ça marche ?
          </h2>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            En quelques étapes seulement, commencez à gagner de l&apos;argent ou trouvez le bon profil.
          </p>
        </div>

        <Tabs.Root defaultValue="student">
          <Tabs.List className="flex w-fit mx-auto gap-1 bg-gray-100 p-1 rounded-xl mb-12">
            {[
              { value: "student", label: "Pour l'étudiant" },
              { value: "client", label: "Pour le client" },
            ].map(({ value, label }) => (
              <Tabs.Trigger
                key={value}
                value={value}
                className={clsx(
                  "py-2 px-5 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap",
                  "text-gray-600 data-[state=active]:bg-white data-[state=active]:text-[#1A6B4A]",
                  "data-[state=active]:shadow-sm data-[state=active]:font-semibold"
                )}
              >
                {label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          <Tabs.Content value="student">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {STUDENT_STEPS.map((step, i) => (
                <StepCard key={step.number} step={step} isLast={i === STUDENT_STEPS.length - 1} />
              ))}
            </div>
          </Tabs.Content>

          <Tabs.Content value="client">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {CLIENT_STEPS.map((step, i) => (
                <StepCard key={step.number} step={step} isLast={i === CLIENT_STEPS.length - 1} />
              ))}
            </div>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </section>
  )
}
