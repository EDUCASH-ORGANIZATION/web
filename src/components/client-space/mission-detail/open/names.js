// Prénoms d'une liste de candidats pour une phrase : « Afiavi, Ulrich et Codjo », au plus trois puis « et N autres ».
export const MAX_NAMES = 3

export function joinNames(names) {
  const list = names.filter(Boolean)
  if (list.length <= 1) return list.join("")
  if (list.length <= MAX_NAMES) return `${list.slice(0, -1).join(", ")} et ${list[list.length - 1]}`
  const rest = list.length - MAX_NAMES
  return `${list.slice(0, MAX_NAMES).join(", ")} et ${rest} ${rest > 1 ? "autres" : "autre"}`
}

// Verbe accordé : « est prévenu » pour un candidat, « sont prévenus » pour plusieurs.
export const notifiedVerb = (names) => (names.filter(Boolean).length > 1 ? "sont prévenus" : "est prévenu")
