export type TechOption = {
    id: string;
    name: string;
    logoURL: string;
};

export const TECH_CATALOG: TechOption[] = [
    { id: 'itc', name: 'Instituto Tecnológico de Culiacán', logoURL: 'assets/tecs/tec_culiacan.png' },
    { id: 'itsj', name: 'Tecnológico Superior de Jalisco', logoURL: 'assets/tecs/tec_jalisco.png' },
    { id: 'itm', name: 'Tecnológico de Mazatlán', logoURL: 'assets/tecs/tec_mazatlan.png' },
    { id: 'itlm', name: 'Tecnológico de los Mochis', logoURL: 'assets/tecs/tec_mochis.png' },
    { id: 'itnn', name: 'Instituto Tecnológico del Norte de Nayarit', logoURL: 'assets/tecs/tec_norte_nayarit.png' },
    { id: 'tss', name: 'Tecnológico Superior de Sinaloa', logoURL: 'assets/tecs/tec_sinaloa.png' },
];

export const TECH_BY_ID = new Map(TECH_CATALOG.map(t => [t.id, t]));