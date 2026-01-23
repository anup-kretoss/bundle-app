import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

// Redirect any access to the old detail route back to the bundles list.
export const loader = async (_ctx: LoaderFunctionArgs) => {
  return redirect("/bundles");
};

export default function BundleDetailsRoute() {
  return null;
}
