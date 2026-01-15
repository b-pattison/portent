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
    @active_encounter = @campaign.encounters.active.first
    @past_encounters = @campaign.encounters.ended.order(created_at: :desc).limit(5)
    @past_encounters_count = @campaign.encounters.ended.count
  end

  def past_encounters
    @campaign = current_user.campaigns.find(params[:id])
    @past_encounters = @campaign.encounters.ended.order(created_at: :desc)
  end

  def start_encounter
    @campaign = current_user.campaigns.find(params[:id])
  
    if @campaign.encounters.active.exists?
      redirect_to campaign_path(@campaign), 
                  alert: "You must end the current active encounter before starting a new one."
      return
    end
  
    @encounter = @campaign.encounters.create!(
      status: "setup",
      round_number: 1
    )
  
    @campaign.characters.pcs.permanent.each do |character|
      @encounter.encounter_participants.create!(
        character: character,
        initiative_mod: character.initiative_mod,
        state: "alive"
      )
    end
  
    redirect_to campaign_encounter_path(@campaign, @encounter),
                notice: "Encounter started! Enter initiative rolls to begin."
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
