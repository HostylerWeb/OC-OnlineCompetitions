"use client";

import { Check, Plus, Trash2 } from "@oc/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import type { CompetitionFormState } from "./types";

interface CompetitionOptionsTabProps {
  form: CompetitionFormState;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFormUpdate: (updater: (prev: CompetitionFormState) => CompetitionFormState) => void;
}

function CompetitionOptionsTab({ form, onChange, onFormUpdate }: CompetitionOptionsTabProps) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="question">Skill Question</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="question"
            name="question"
            value={form.question}
            onChange={onChange}
            placeholder="e.g. What is 2 + 2?"
          />
        </InputGroup>
        <FieldDescription>
          Customers must answer correctly before completing their purchase.
        </FieldDescription>
      </Field>

      <FieldSet>
        <div className="flex items-center justify-between gap-3">
          <FieldLegend variant="label">Answer Options</FieldLegend>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onFormUpdate((p) => ({ ...p, questionOptions: [...p.questionOptions, ""] }))
            }
          >
            <Plus data-icon="inline-start" />
            Add Option
          </Button>
        </div>

        <FieldDescription>Select one option as the correct answer.</FieldDescription>

        <div className="flex flex-col gap-3">
          {form.questionOptions.map((option, index) => (
            <Field key={index}>
              <FieldLabel htmlFor={`question-option-${index}`} className="sr-only">
                Option {index + 1}
              </FieldLabel>
              <InputGroup
                className={
                  form.correctAnswer === index ? "border-primary/40 bg-primary/5" : undefined
                }
              >
                <InputGroupAddon align="inline-start">
                  <InputGroupText>{index + 1}.</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id={`question-option-${index}`}
                  value={option}
                  onChange={(e) => {
                    const next = [...form.questionOptions];
                    next[index] = e.target.value;
                    onFormUpdate((p) => ({ ...p, questionOptions: next }));
                  }}
                  placeholder={`Option ${index + 1}`}
                />
                <InputGroupAddon align="inline-end" className="flex items-center gap-1 pr-1">
                  <InputGroupButton
                    type="button"
                    variant={form.correctAnswer === index ? "default" : "outline"}
                    size="xs"
                    onClick={() =>
                      onFormUpdate((p) => ({
                        ...p,
                        correctAnswer: p.correctAnswer === index ? -1 : index,
                      }))
                    }
                  >
                    <Check data-icon="inline-start" />
                    {form.correctAnswer === index ? "Correct" : "Mark"}
                  </InputGroupButton>
                  <InputGroupButton
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => {
                      const next = form.questionOptions.filter((_, i) => i !== index);
                      onFormUpdate((p) => ({
                        ...p,
                        questionOptions: next,
                        correctAnswer:
                          p.correctAnswer === index
                            ? -1
                            : p.correctAnswer > index
                              ? p.correctAnswer - 1
                              : p.correctAnswer,
                      }));
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                    <span className="sr-only">Remove option {index + 1}</span>
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>
          ))}
        </div>

        {form.questionOptions.length === 0 ? (
          <FieldDescription>No options yet. Add at least two answers.</FieldDescription>
        ) : null}

        {form.correctAnswer === -1 && form.questionOptions.some((o) => o !== "") ? (
          <Alert>
            <AlertDescription>
              No correct answer selected. The correct answer will not be saved.
            </AlertDescription>
          </Alert>
        ) : null}
      </FieldSet>
    </FieldGroup>
  );
}

export { CompetitionOptionsTab };
