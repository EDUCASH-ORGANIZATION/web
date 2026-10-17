import { describe, it, expect } from "vitest"
import { validateStudentProfile } from "./profile-rules"

const valid = {
  fullName: "Sèna Agossou",
  city: "Abomey-Calavi",
  phone: "01 97 45 21 08",
  bio: "",
  school: "UAC",
  level: "Licence 2",
  availability: "Week-end",
  skills: ["Informatique"],
}

describe("validateStudentProfile : libellé réservé", () => {
  it.each(["Compte clôturé", "compte cloture", "  COMPTE   CLÔTURÉ ", "Compte\u00a0clôturé"])(
    "refuse %j comme nom",
    (fullName) => {
      expect(validateStudentProfile({ ...valid, fullName }).fullName).toBe("Ce nom n'est pas disponible.")
    },
  )

  it("accepte un nom ordinaire, même proche du libellé", () => {
    expect(validateStudentProfile(valid).fullName).toBeUndefined()
    expect(validateStudentProfile({ ...valid, fullName: "Compte Clôturé Agossou" }).fullName).toBeUndefined()
  })
})
