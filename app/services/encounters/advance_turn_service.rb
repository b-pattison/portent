module Encounters
  class AdvanceTurnService
    SAVE_ABILITY_NAMES = {
      0 => "wis",
      1 => "int",
      2 => "str",
      3 => "con",
      4 => "dex"
    }.freeze

    def initialize(encounter)
      @encounter = encounter
    end

    def call!
      result = { status: :ok, interrupt: nil }
      
      @encounter.transaction do
        @encounter.lock!
        
        current_round = @encounter.round_number
        ordered_participants = @encounter.encounter_participants
                                          .where.not(state: ["removed", "dead"])
                                          .where("added_in_round IS NULL OR added_in_round <= ?", current_round)
                                          .order(initiative_total: :desc, initiative_roll: :desc, id: :asc)
                                          .to_a
        
        return result if ordered_participants.empty?
        
        current_active = @encounter.active_participant
        
        # Determine next participant and new round number
        next_participant = nil
        new_round = current_round
        
        if current_active.nil?
          next_participant = ordered_participants.first
        else
          current_index = ordered_participants.find_index { |p| p.id == current_active.id }
          
          if current_index.nil?
            next_participant = ordered_participants.first
          elsif current_index == ordered_participants.length - 1
            # End of round - check for round-based effects
            new_round = current_round + 1
            check_and_end_round_effects(new_round)
            next_participant = ordered_participants.first
          else
            next_participant = ordered_participants[current_index + 1]
          end
        end

        # Before advancing, check for end-of-turn effects on current participant
        # Also check if any effects should expire based on duration
        if current_active
          # Check if effects should expire (duration-based removal)
          check_and_end_effects_on_turn_end(current_active, current_round)
          
          interrupt = check_end_of_turn_effects(current_active, current_round)
          if interrupt
            result[:status] = :interrupt
            result[:interrupt] = interrupt
            return result
          end
        end

        # Advance to next participant
        if current_active.nil?
          @encounter.update!(
            active_participant_id: next_participant.id,
            round_number: 1,
            status: "active"
          )
        else
          @encounter.update!(
            active_participant_id: next_participant.id,
            round_number: new_round
          )
        end

        # Check for start-of-turn effects on new participant
        # Also check if any effects should expire based on duration
        check_and_end_effects_on_turn_start(next_participant, new_round)
        
        interrupt = check_start_of_turn_effects(next_participant)
        if interrupt
          result[:status] = :interrupt
          result[:interrupt] = interrupt
          return result
        end
      end

      result
    end

    private

    def check_end_of_turn_effects(participant, current_round)
      active_effects = @encounter.encounter_effects.where(ended_at: nil).to_a
      
      active_effects.each do |effect|
        target = EncounterEffectTarget.where(
          encounter_effect_id: effect.id,
          encounter_participant_id: participant.id,
          active: true,
          ended_at: nil,
          trigger_timing: "end_of_turn"
        ).first
        
        next unless target

        # Skip if trigger timing is "no_trigger" - these don't trigger prompts
        next if target.trigger_timing == "no_trigger"

        # Check if effect should trigger
        if effect.save_ability.present?
          save_ability_str = SAVE_ABILITY_NAMES[effect.save_ability] || effect.save_ability.to_s
          return {
            target_id: target.id,
            effect_name: effect.name,
            save_ability: save_ability_str,
            participant_name: participant.character.name
          }
        else
          # No save required, apply HP effect immediately
          apply_hp_effect(effect, participant)
        end
      end

      nil
    end

    def check_start_of_turn_effects(participant)
      active_effects = @encounter.encounter_effects.where(ended_at: nil).to_a
      
      active_effects.each do |effect|
        target = EncounterEffectTarget.where(
          encounter_effect_id: effect.id,
          encounter_participant_id: participant.id,
          active: true,
          ended_at: nil,
          trigger_timing: "start_of_turn"
        ).first
        
        next unless target

        # Skip if trigger timing is "no_trigger" - these don't trigger prompts
        next if target.trigger_timing == "no_trigger"

        if effect.save_ability.present?
          save_ability_str = SAVE_ABILITY_NAMES[effect.save_ability] || effect.save_ability.to_s
          return {
            target_id: target.id,
            effect_name: effect.name,
            save_ability: save_ability_str,
            participant_name: participant.character.name
          }
        else
          # No save required, apply HP effect immediately
          apply_hp_effect(effect, participant)
        end
      end

      nil
    end

    def check_and_end_round_effects(new_round)
      @encounter.encounter_effects.where(ended_at: nil).each do |effect|
        if effect.duration_type == "end_of_round" && effect.expires_on_round == new_round
          # Duration expired - end effect regardless of save pass/fail
          effect.end!
        elsif effect.duration_type == "time"
          effect.duration_rounds -= 1
          if effect.duration_rounds <= 0
            # Duration expired - end effect regardless of save pass/fail
            effect.end!
          else
            effect.save!
          end
        end
      end
    end

    def check_and_end_effects_on_turn_end(participant, current_round)
      # Check for effects that expire at the end of this participant's turn
      @encounter.encounter_effects.where(ended_at: nil).each do |effect|
        if effect.duration_type == "end_of_turn" && 
           effect.expires_on_participant_id == participant.id &&
           current_round >= effect.expires_on_round
          # Duration expired - end effect regardless of save pass/fail
          effect.end!
        end
      end
    end

    def check_and_end_effects_on_turn_start(participant, current_round)
      # Check for effects that expire at the start of this participant's turn
      # (This is mainly for consistency, end_of_turn effects are checked at end of turn)
      @encounter.encounter_effects.where(ended_at: nil).each do |effect|
        if effect.duration_type == "end_of_turn" && 
           effect.expires_on_participant_id == participant.id &&
           current_round >= effect.expires_on_round
          # Duration expired - end effect regardless of save pass/fail
          effect.end!
        end
      end
    end

    def apply_hp_effect(effect, participant)
      # TODO: Apply hp_delta to participant/character
      # For MVP, we'll track this conceptually
      # participant.character.update!(hp: participant.character.hp + effect.hp_delta)
    end
  end
end
    