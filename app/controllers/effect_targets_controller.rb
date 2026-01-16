class EffectTargetsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_campaign
  before_action :set_encounter
  before_action :set_target
  before_action :ensure_not_ended

  def resolve
    effect = @target.encounter_effect.reload
    participant = @target.encounter_participant

    passed = params[:passed] == true || params[:passed] == "true"
    requires_save = effect.save_ability.present?

    if effect.name == "Death Saves"
      was_active = @encounter.active_participant_id == participant.id
      
      if passed
        @target.death_save_successes += 1
        if @target.death_save_successes >= 2
          effect.end!
          @target.end!
        else
          @target.save!
        end
      else
        @target.death_save_failures += 1
        if @target.death_save_failures >= 2
          participant.update!(state: "dead")
          effect.end!
          @target.end!
          
          if was_active && @encounter.status == "active"
            Encounters::AdvanceTurnService.new(@encounter.reload).call!
          end
        else
          @target.save!
        end
      end
      
      render json: Encounters::StatePresenter.new(@encounter.reload), status: :ok
      return
    end

    if !requires_save || !passed
      if effect.hp_delta != 0
      end
    end

    current_round = @encounter.round_number
    duration_expired = false

    case effect.duration_type
    when "end_of_round"
      duration_expired = effect.expires_on_round && current_round > effect.expires_on_round
    when "end_of_turn"
      duration_expired = effect.expires_on_participant_id == participant.id &&
                        effect.expires_on_round && current_round == effect.expires_on_round
    when "time"
      duration_expired = effect.duration_rounds && effect.duration_rounds <= 0
    end

    if duration_expired
      effect.end!
    elsif requires_save
      if passed
        @target.end!
      end
    end

    render json: { success: true }, status: :ok
  end

  private

  def set_campaign
    @campaign = current_user.campaigns.find(params[:campaign_id])
  end

  def set_encounter
    @encounter = @campaign.encounters.find(params[:id])
  end

  def set_target
    @target = EncounterEffectTarget.find(params[:target_id])
    unless @target.encounter_effect.encounter_id == @encounter.id
      render json: { error: "Target not found" }, status: :not_found
    end
  end

  def ensure_not_ended
    redirect_to [@campaign, @encounter], alert: "That encounter has ended." if @encounter.status == "ended"
  end
end
