class EncounterEffectsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_campaign
  before_action :set_encounter
  before_action :ensure_not_ended

  def index
    effects = @encounter.encounter_effects.active.includes(:targets, :expires_on_participant)
    render json: {
      effects: effects.map do |effect|
        {
          id: effect.id,
          name: effect.name,
          note: effect.note,
          duration_type: effect.duration_type,
          expires_on_round: effect.expires_on_round,
          expires_on_participant_id: effect.expires_on_participant_id,
          duration_rounds: effect.duration_rounds,
          save_ability: effect.save_ability,
          hp_delta: effect.hp_delta,
          targets: effect.targets.active.map do |target|
            {
              id: target.id,
              participant_id: target.encounter_participant_id,
              trigger_timing: target.trigger_timing
            }
          end
        }
      end
    }
  end

  def create
    # Validate that at least one target is selected
    if params[:target_ids].blank? || params[:target_ids].empty?
      render json: { errors: ["Please select at least one character to affect."] }, status: :unprocessable_entity
      return
    end

    effect = @encounter.encounter_effects.build(effect_params)
    effect.hp_delta = 0 if effect.hp_delta.nil?
    
    duration_type = params[:duration_type] || params[:effect]&.dig(:duration_type)
    effect.duration_type = duration_type if duration_type.present?

    case duration_type
    when "end_of_round"
      effect.expires_on_round = @encounter.round_number
    when "end_of_turn"
      if @encounter.active_participant.present?
        effect.expires_on_participant_id = @encounter.active_participant.id
        effect.expires_on_round = @encounter.round_number + 1
      else
        render json: { errors: ["Cannot set effect to end on character's turn: no active participant in encounter"] }, status: :unprocessable_entity
        return
      end
    when "time"
      amount = params[:time_amount].to_i
      unit = params[:time_unit]
      seconds = unit == "minutes" ? amount * 60 : amount
      effect.duration_rounds = (seconds / 6.0).ceil
    end

    if effect.save
      effect.reload
      all_timings_none = true
      if params[:target_ids].present?
        params[:target_ids].each do |target_id|
          timing = params[:target_timings]&.dig(target_id) || "no_trigger"
          all_timings_none = false if timing != "no_trigger"
          EncounterEffectTarget.create!(
            encounter_effect: effect,
            encounter_participant_id: target_id,
            trigger_timing: timing
          )
        end
      end
      
      if all_timings_none && effect.save_ability.present?
        effect.update!(save_ability: nil)
      end

      render json: { success: true, effect: { id: effect.id } }, status: :created
    else
      render json: { errors: effect.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    effect = @encounter.encounter_effects.find(params[:effect_id])
    effect.end!
    render json: { success: true }, status: :ok
  end

  private

  def set_campaign
    @campaign = current_user.campaigns.find(params[:campaign_id])
  end

  def set_encounter
    @encounter = @campaign.encounters.find(params[:id])
  end

  def ensure_not_ended
    redirect_to [@campaign, @encounter], alert: "That encounter has ended." if @encounter.status == "ended"
  end

  def effect_params
    params.require(:effect).permit(:name, :note, :duration_type, :save_ability, :hp_delta)
  end
end
