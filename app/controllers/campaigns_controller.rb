class CampaignsController < ApplicationController
  before_action :authenticate_user!
  before_action :check_for_pcs, only: [:start_encounter]

  def index
    @campaigns = current_user.campaigns.to_a
    @campaign  = current_user.campaigns.new
  end

  def new
    @campaign = current_user.campaigns.build
  end

  def create
    if !current_user.can_create_campaign?
      redirect_to campaigns_path, alert: "Upgrade to create more campaigns."
      return
    end

    @campaigns = current_user.campaigns.to_a
    @campaign  = current_user.campaigns.new(campaign_params)

    if @campaign.save
      redirect_to campaigns_path, notice: "Campaign created!"
    else
      render :index, status: :unprocessable_entity
    end
  end

  def show
    @campaign = current_user.campaigns.find(params[:id])
  end

  def start_encounter
    @campaign = current_user.campaigns.find(params[:id])
    @encounter = @campaign.encounters.create(status: "setup")
    @campaign.characters.pcs.each do |character|
      @encounter.encounter_participants.create(character: character, state: "alive")
    end
    redirect_to encounter_path(@campaign, @encounter), notice: "Encounter started!"
  end

  private

  def campaign_params
    params.require(:campaign).permit(:name)
  end

  def check_for_pcs
    @campaign = current_user.campaigns.find(params[:id])
    if @campaign.characters.pcs.empty?
      redirect_to campaign_path(@campaign), alert: "You need to add at least one PC to start an encounter."
    end
  end
  
end
