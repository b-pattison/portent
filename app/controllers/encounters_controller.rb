class EncountersController < ApplicationController
  before_action :authenticate_user!
  before_action :ensure_not_ended, only: %i[update_rolls add_combatant advance_turn]
  before_action :set_campaign
  before_action :set_encounter, only: %i[show update_rolls add_combatant end_encounter state advance_turn ensure_not_ended]

#   {
#   "encounter": {
#     "id": 123,
#     "status": "active",
#     "round": 2,
#     "active_participant_id": 55
#   },
#   "participants": [
#     {
#       "id": 55,
#       "name": "Finch",
#       "kind": "pc",
#       "initiative_total": 17,
#       "hp": 24,
#       "max_hp": 31
#     }
#   ]
# }
  def state
    render json: Encounters::StatePresenter.new(@encounter).as_json
  end

  def advance_turn
    result = Encounters::AdvanceTurnService.new(@encounter).call!
    @encounter.reload
    
    state_data = Encounters::StatePresenter.new(@encounter).as_json
    
    if result[:status] == :interrupt
      render json: {
        status: "interrupt",
        interrupt: result[:interrupt],
        encounter: state_data[:encounter],
        participants: state_data[:participants],
        dead_participants: state_data[:dead_participants]
      }
    else
      render json: {
        status: "ok",
        encounter: state_data[:encounter],
        participants: state_data[:participants],
        dead_participants: state_data[:dead_participants]
      }
    end
  end

  def show
    seed_from_pcs_if_empty!(@encounter, @campaign)

    activate_if_ready!

    @participants = @encounter.encounter_participants
                              .includes(:character)
                              .order(:id)

    @new_combatant = @encounter.encounter_participants.new
    @missing_rolls = @participants.reject { |p| p.state == "removed" }
                                  .any? { |p| p.initiative_roll.nil? }
  end

  def update_rolls
    active_participants = @encounter.encounter_participants.where.not(state: "removed")
    
    submitted_ids = participants_params.keys.map(&:to_i)
    active_ids = active_participants.pluck(:id)
    
    missing_from_params = (active_ids - submitted_ids).any?
    if missing_from_params
      redirect_to [@campaign, @encounter], 
                  alert: "All combatants must have an initiative roll before the encounter can start."
      return
    end
    
    missing_rolls = active_ids.any? do |id|
      attrs = participants_params[id.to_s]
      attrs[:initiative_roll].blank?
    end
    
    if missing_rolls
      redirect_to [@campaign, @encounter], 
                  alert: "All combatants must have an initiative roll before the encounter can start."
      return
    end

    participants_params.each do |participant_id, attrs|
      participant = @encounter.encounter_participants.find(participant_id)

      next if participant.state == "removed"

      roll = attrs[:initiative_roll].presence&.to_i
      mod  = participant.initiative_mod.to_i

      participant.update!(
        initiative_roll: roll,
        initiative_total: roll.nil? ? nil : roll + mod
      )
    end

    @encounter.reload

    activate_if_ready!

    redirect_to [@campaign, @encounter],
                notice: (@encounter.status == "active" ? "Encounter is active!" : "Initiative saved!")
  end

  def add_combatant
    character = @campaign.characters.create!(
      name: params.require(:character).fetch(:name),
      pc: false,
      temporary: true,
      initiative_mod: params.require(:character).fetch(:initiative_mod).to_i
    )

    # Attach avatar if provided
    if params[:character][:avatar].present?
      character.avatar.attach(params[:character][:avatar])
    end

    was_active = @encounter.status == "active"
    
    # Set added_in_round: nil for setup mode, next round for active encounters
    added_in_round = was_active ? @encounter.round_number + 1 : nil
    
    participant = @encounter.encounter_participants.create!(
      character: character,
      initiative_mod: character.initiative_mod,
      state: "alive",
      added_in_round: added_in_round
    )

    # If initiative_roll is provided, save it and calculate total
    if params[:character][:initiative_roll].present?
      roll = params[:character][:initiative_roll].to_i
      mod = participant.initiative_mod.to_i
      participant.update!(
        initiative_roll: roll,
        initiative_total: roll + mod
      )
    end

    if was_active
      # During active encounter, don't reset status - combatant will be added to list
      # but current turn order is preserved. They'll join on the next round.
      redirect_to [@campaign, @encounter], notice: "Combatant added! They will join the initiative order at the start of round #{added_in_round}."
    else
      # During setup, allow normal flow
      redirect_to [@campaign, @encounter], notice: "Combatant added!"
    end
  end

  def end_encounter
    @encounter.update!(
      status: "ended",
      active_participant_id: nil
    )

    redirect_to campaign_path(@campaign), notice: "Encounter ended."
  end

  def ensure_not_ended
    return unless @encounter&.status == "ended"
    redirect_to [@campaign, @encounter], alert: "That encounter has ended."
  end

  private

  def set_campaign
    @campaign = current_user.campaigns.find(params[:campaign_id])
  end

  def set_encounter
    @encounter = @campaign.encounters.find(params[:id])
  end

  def participants_params
    params.require(:participants).permit!.to_h
  end

  def activate_if_ready!
    current_round = @encounter.round_number
    active_participants = @encounter.encounter_participants
                                    .where.not(state: "removed")
                                    .where.not(initiative_roll: nil)
                                    .where("added_in_round IS NULL OR added_in_round <= ?", current_round)

    all_active = @encounter.encounter_participants
                          .where.not(state: "removed")
                          .where("added_in_round IS NULL OR added_in_round <= ?", current_round)
    return unless all_active.count == active_participants.count
    return if active_participants.empty?

    ordered = active_participants.order(initiative_total: :desc, initiative_roll: :desc, id: :asc)
    first_up = ordered.first
    return unless first_up

    if @encounter.status == "setup"
      @encounter.update!(
        status: "active",
        active_participant_id: first_up.id,
        round_number: 1
      )
    elsif @encounter.active_participant_id.nil?
      @encounter.update!(active_participant_id: first_up.id)
    end
  end

  def seed_from_pcs_if_empty!(encounter, campaign)
    return if encounter.encounter_participants.exists?

    campaign.characters.pcs.permanent.find_each do |character|
      encounter.encounter_participants.create!(
        character: character,
        initiative_mod: character.initiative_mod,
        state: "alive"
      )
    end
  end
end
