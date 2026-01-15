class EncounterParticipantsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_campaign
  before_action :set_encounter
  before_action :set_participant

  def update
    was_active = @encounter.active_participant_id == @participant.id
    @participant.update!(permitted_params)
    
    if was_active && @participant.state == "dead" && @encounter.status == "active"
      Encounters::AdvanceTurnService.new(@encounter.reload).call!
    end
    
    render json: Encounters::StatePresenter.new(@encounter.reload), status: :ok
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages }, status: :unprocessable_entity
  end

  private

  def permitted_params
    params.require(:encounter_participant).permit(:state)
  end

  def set_encounter
    @encounter = @campaign.encounters.find(params[:encounter_id])
  end

  def set_campaign
    @campaign = current_user.campaigns.find(params[:campaign_id])
  end

  def set_participant
    @participant = @encounter.encounter_participants.find(params[:id])
  end
end
