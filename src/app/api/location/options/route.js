import { NextResponse } from "next/server";
import { Country, State } from "country-state-city";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const countryCode = searchParams.get("country");
  if (!countryCode) {
    const countries = Country.getAllCountries().map(({ name, isoCode, phonecode, flag }) => ({
      name,
      isoCode,
      phonecode: phonecode.startsWith("+") ? phonecode : `+${phonecode}`,
      flag,
    }));
    return NextResponse.json({ countries });
  }

  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return NextResponse.json({ error: "Invalid country code." }, { status: 400 });
  }

  const states = State.getStatesOfCountry(countryCode).map(({ name, isoCode }) => ({
    name,
    isoCode,
  }));
  return NextResponse.json({ states });
}
