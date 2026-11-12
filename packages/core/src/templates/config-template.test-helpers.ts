import { expect } from "vitest";
import { getModulesForTemplate } from "../generator/proxy-groups";
import {
  SUBFUSE_TEMPLATE_CONFIG_SCHEMA,
  validateSubFuseTemplateConfig,
} from "./config-template";
import type { SubFuseTemplateConfig } from "@subfuse/core/types/template-config";

export function validConfig(patch: Partial<SubFuseTemplateConfig> & Record<string, unknown> = {}): SubFuseTemplateConfig {
  return {
    schema: SUBFUSE_TEMPLATE_CONFIG_SCHEMA,
    template: "minimal",
    enabledProxyGroups: getModulesForTemplate("minimal"),
    hiddenProxyGroups: [],
    customProxyGroups: [],
    proxyGroupAdvanced: {},
    customRuleSets: [],
    builtinRuleEdits: {},
    customRules: [],
    ruleOrder: [],
    dialerProxyGroups: [],
    proxyGroupNameOverrides: {},
    dnsYaml: "",
    mixedPort: 7897,
    allowLan: true,
    testUrl: "https://www.gstatic.com/generate_204",
    testInterval: 300,
    ruleProviderBaseUrl: "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo",
    cnIpNoResolve: true,
    experimentalCnUseCnRuleSet: true,
    ...patch,
  } as SubFuseTemplateConfig;
}

export function expectInvalid(patch: Partial<SubFuseTemplateConfig> & Record<string, unknown>, error: string) {
  expect(validateSubFuseTemplateConfig(validConfig(patch))).toEqual({ ok: false, error });
}
