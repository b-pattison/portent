class CampaignsController < ApplicationController
  def index
    #List campaigns
    @campaigns = current_user.campaigns
  end

  def new
    #New campaign
    @campaign = current_user.campaigns.build
  end

  def create
    #Check if user is premium
    if !current_user.can_create_campaign?
      redirect_to campaigns_path, alert: "Upgrade to create more campaigns."
      return
    end
    #Create campaign
    @campaign = current_user.campaigns.build(campaign_params)
    if @campaign.save
      redirect_to campaigns_path, notice: "Campaign created successfully: #{@campaign.name}"
    else
      render :new, status: :unprocessable_entity
    end
  end

  def show
    #Show campaign
    @campaign = current_user.campaigns.find(params[:id])
  end
end
