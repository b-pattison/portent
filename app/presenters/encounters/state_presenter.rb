# frozen_string_literal: true

module Encounters
    class StatePresenter
      def initialize(encounter)
        @encounter = encounter
      end

    def as_json(*)
        {
        encounter: {
            id: @encounter.id,
            status: @encounter.status,
            round: @encounter.round_number,
            active_participant_id: @encounter.active_participant_id
        },
        participants: active_participants_for_round.map do |p|
            {
              id: p.id,
              name: p.character.name,
              kind: p.character.pc? ? "pc" : "npc",
              initiative_total: p.initiative_total,
              state: p.state,
              avatar_url: p.character.avatar.attached? ? Rails.application.routes.url_helpers.url_for(p.character.avatar) : nil,
              active_effects: active_effects_for_participant(p)
            }
          end,
        dead_participants: dead_participants.map do |p|
            {
              id: p.id,
              name: p.character.name,
              kind: p.character.pc? ? "pc" : "npc",
              state: p.state,
              avatar_url: p.character.avatar.attached? ? Rails.application.routes.url_helpers.url_for(p.character.avatar) : nil,
              active_effects: active_effects_for_participant(p)
            }
          end
        }
    end
  
  
      private
  
      attr_reader :encounter
  
      def encounter_payload
        {
          id: encounter.id,
          status: encounter.status,
          round_number: encounter.round_number,
          active_participant_id: encounter.active_participant_id
        }
      end
  
      def participants_payload
        ordered_participants.map do |p|
          {
            id: p.id,
            character_id: p.character_id,
            name: p.character.name,
            kind: character_kind(p.character),
            initiative_roll: p.initiative_roll,
            initiative_mod: p.initiative_mod,
            initiative_total: p.initiative_total,
            state: p.state
          }
        end
      end
  
      def active_participants_for_round
        current_round = encounter.round_number
        encounter
          .encounter_participants
          .includes(:character)
          .where.not(state: ["removed", "dead"])
          .where("added_in_round IS NULL OR added_in_round <= ?", current_round)
          .order(initiative_total: :desc, id: :asc)
      end

      def dead_participants
        encounter
          .encounter_participants
          .includes(:character)
          .where(state: "dead")
          .order(id: :asc)
      end

      def ordered_participants
        encounter
          .encounter_participants
          .includes(:character)
          .where.not(state: ["removed", "dead"])
          .order(initiative_total: :desc, id: :asc)
      end
  
      def character_kind(character)
        character.pc? ? "pc" : "npc"
      end

      def active_effects_for_participant(participant)
        targets = EncounterEffectTarget
                    .where(
                      encounter_participant_id: participant.id,
                      active: true,
                      ended_at: nil
                    )
                    .includes(:encounter_effect)
        
        effect_ids = targets.pluck(:encounter_effect_id)
        
        encounter.encounter_effects
                 .where(id: effect_ids, ended_at: nil)
                 .map do |effect|
                   target = targets.find { |t| t.encounter_effect_id == effect.id }
                   effect_data = { id: effect.id, name: effect.name }
                   
                   if effect.name == "Death Saves" && target
                     effect_data[:death_save_successes] = target.death_save_successes || 0
                     effect_data[:death_save_failures] = target.death_save_failures || 0
                   end
                   
                   effect_data
                 end
      end
    end
  end
  