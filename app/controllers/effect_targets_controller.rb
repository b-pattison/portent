class EffectTargetsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_campaign
  before_action :set_encounter
  before_action :set_target
  before_action :ensure_not_ended

  def resolve
    effect = @target.encounter_effect
    participant = @target.encounter_participant

    passed = params[:passed] == true || params[:passed] == "true"
    requires_save = effect.save_ability.present?

    if !requires_save || !passed
      if effect.hp_delta != 0
      end
    end

    if passed && requires_save
      @target.end!
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
