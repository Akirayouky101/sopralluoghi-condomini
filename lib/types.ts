export type WorkSection = {
  title: string;
  checks: string[];
};

export type ComponentItem = {
  id?: string;
  name: string;
  category: string;
  unit: string;
  brand?: string | null;
  supplier?: string | null;
  notes?: string | null;
};

export type SurveyDraft = {
  condominiumName: string;
  address: string;
  contact: string;
  surveyDate: string;
  selectedWorks: string[];
  materials: string;
  notes: string;
};
