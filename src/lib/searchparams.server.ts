import { createSearchParamsCache } from "nuqs/server";

import { searchParamsParsers } from "@/lib/searchparams";

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);

